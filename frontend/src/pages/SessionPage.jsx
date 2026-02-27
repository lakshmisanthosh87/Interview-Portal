import { useUser } from "@clerk/clerk-react";
import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router";
import { useEndSession, useJoinSession, useSessionById } from "../hooks/useSessions";
import { PROBLEMS } from "../data/Problems";
import { executeCode } from "../lib/piston";
import Navbar from "../components/Navbar";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { getDifficultyBadgeClass } from "../lib/utils";
import { Loader2Icon, LogOutIcon, PhoneOffIcon, ShareIcon } from "lucide-react";
import CodeEditor from "../components/CodeEditor";
import OutputPanel from "../components/OutputPanel";
import toast from "react-hot-toast";

import { StreamCall, StreamVideo } from "@stream-io/video-react-sdk";
import VideoCallUI from "../components/VideoCallUI";
import { useLiveSession } from "../context/LiveSessionContext";

function SessionPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useUser();
  const [output, setOutput] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const isRemoteChange = useRef(false);

  const { data: sessionData, isLoading: loadingSession, refetch } = useSessionById(id);

  const joinSessionMutation = useJoinSession();
  const endSessionMutation = useEndSession();

  const session = sessionData?.session;
  const isHost = session?.host?.clerkId === user?.id;
  const isParticipant = session?.participant?.clerkId === user?.id;

  const {
    isLive,
    isJoining,
    isMinimized,
    setIsMinimized,
    joinSession,
    leaveSession,
    isInitializingCall: globalInitializing,
    streamClient,
    call,
    chatClient,
    channel,
    joinError,
    setJoinError
  } = useLiveSession();

  const isInitializingCall = globalInitializing || loadingSession;

  // find the problem data based on session problem title OR custom problem data
  const problemData = session?.customProblemId
    ? session.customProblemId // Use populated custom problem data
    : (session?.problem ? Object.values(PROBLEMS).find((p) => p.title === session.problem) : null);

  const [selectedLanguage, setSelectedLanguage] = useState("javascript");
  const [code, setCode] = useState(problemData?.starterCode?.[selectedLanguage] || "");

  // auto-join session if user is not already a participant and not the host
  useEffect(() => {
    if (!session || !user || loadingSession || isLive || isJoining || globalInitializing || joinError) return;

    if (isHost || isParticipant) {
      joinSession(session, isHost, isParticipant);
    } else {
      // Only guest joins
      joinSessionMutation.mutate(id, {
        onSuccess: (data) => {
          refetch();
          joinSession(data.session, false, true);
        },
        onError: (error) => {
          console.error("Join failed:", error);
          navigate("/dashboard");
        }
      });
    }
  }, [session, user, loadingSession, isLive, isJoining, globalInitializing, joinError, isHost, isParticipant, id]);

  // redirect the "participant" when session ends
  useEffect(() => {
    if (!session || loadingSession) return;

    if (session.status === "completed") navigate("/dashboard");
  }, [session, loadingSession, navigate]);

  // update code when problem loads or changes
  useEffect(() => {
    if (problemData?.starterCode?.[selectedLanguage] && !code) {
      setCode(problemData.starterCode[selectedLanguage]);
    }
  }, [problemData, selectedLanguage, code]);

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setSelectedLanguage(newLang);
    // use problem-specific starter code
    const starterCode = problemData?.starterCode?.[newLang] || "";
    setCode(starterCode);
    setOutput(null);

    // Sync language change
    if (channel) {
      channel.sendEvent({
        type: "language-update",
        language: newLang,
        starterCode: starterCode
      });
    }
  };

  const handleRunCode = async () => {
    setIsRunning(true);
    setOutput(null);

    const result = await executeCode(selectedLanguage, code);
    setOutput(result);
    setIsRunning(false);
  };

  // Real-time synchronization
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    if (!channel || !user) return;

    const handleEvent = (event) => {
      // Ignore events from ourselves
      if (!event.user || event.user.id === user.id) return;

      if (event.type === "code-update") {
        // Only update if the incoming update is newer than our last known update
        if (event.timestamp > lastUpdateRef.current) {
          lastUpdateRef.current = event.timestamp;
          if (event.code !== code) {
            console.log("[CodeSync] Applying remote update...");
            isRemoteChange.current = true;
            setCode(event.code);
          }
        }
      } else if (event.type === "language-update") {
        if (event.language !== selectedLanguage) {
          setSelectedLanguage(event.language);
          if (event.starterCode) {
            isRemoteChange.current = true;
            setCode(event.starterCode);
          }
        }
      } else if (event.type === "request-sync" && isHost) {
        console.log("[CodeSync] Received sync request, sending state...");
        // Send current state to joining participant
        channel.sendEvent({
          type: "code-update",
          code: code,
          language: selectedLanguage,
          timestamp: Date.now(),
        });
      }
    };

    channel.on(handleEvent);

    // Request initial sync when component mounts if not host
    if (!isHost && isLive) {
      console.log("[CodeSync] Requesting initial sync from host...");
      channel.sendEvent({ type: "request-sync" });
    }

    return () => channel.off(handleEvent);
  }, [channel, user, isHost, code, selectedLanguage, isLive]);

  // Debounced code emission
  useEffect(() => {
    if (!channel || !user || !isLive) return;

    // If change was remote, don't emit it back
    if (isRemoteChange.current) {
      isRemoteChange.current = false;
      return;
    }

    const timeout = setTimeout(() => {
      const now = Date.now();
      lastUpdateRef.current = now;
      console.log("[CodeSync] Emitting code update...");
      channel.sendEvent({
        type: "code-update",
        code: code,
        timestamp: now,
      });
    }, 200); // Reduced debounce for faster sync

    return () => clearTimeout(timeout);
  }, [code, channel, user, isLive]);

  const handleEndSession = async () => {
    if (confirm("Are you sure you want to end this session? All participants will be notified.")) {
      await leaveSession();
      endSessionMutation.mutate(id, { onSuccess: () => navigate("/dashboard") });
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success("Session link copied to clipboard!");
  };

  return (
    <div className="h-screen bg-base-100 flex flex-col">
      <Navbar />

      <div className="flex-1">
        <PanelGroup direction="horizontal">
          {/* LEFT PANEL - CODE EDITOR & PROBLEM DETAILS */}
          <Panel defaultSize={50} minSize={30}>
            <PanelGroup direction="vertical">
              {/* PROBLEM DSC PANEL */}
              <Panel defaultSize={50} minSize={20}>
                <div className="h-full overflow-y-auto bg-base-200">
                  {/* HEADER SECTION */}
                  <div className="p-6 bg-base-100 border-b border-base-300">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h1 className="text-3xl font-bold text-base-content">
                          {session?.problem || "Loading..."}
                        </h1>
                        {problemData?.category && (
                          <p className="text-base-content/60 mt-1">{problemData.category}</p>
                        )}
                        <p className="text-base-content/60 mt-2">
                          Host: {session?.host?.name || "Loading..."}
                          {session?.participant && (
                            <> • Participant: {session.participant.name}</>
                          )}
                          {!session?.participant && (
                            <> • {session?.participants?.length || 1}/2 participants</>
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`badge badge-lg ${getDifficultyBadgeClass(
                            session?.difficulty
                          )}`}
                        >
                          {session?.difficulty.slice(0, 1).toUpperCase() +
                            session?.difficulty.slice(1) || "Easy"}
                        </span>
                        {isHost && session?.status === "active" && (
                          <div className="flex items-center gap-2">
                            <button onClick={handleShare} className="btn btn-ghost btn-sm gap-2">
                              <ShareIcon className="w-4 h-4" />
                              Share
                            </button>
                            <button
                              onClick={handleEndSession}
                              disabled={endSessionMutation.isPending}
                              className="btn btn-error btn-sm gap-2"
                            >
                              {endSessionMutation.isPending ? (
                                <Loader2Icon className="w-4 h-4 animate-spin" />
                              ) : (
                                <LogOutIcon className="w-4 h-4" />
                              )}
                              End Session
                            </button>
                          </div>
                        )}
                        {session?.status === "completed" && (
                          <span className="badge badge-ghost badge-lg">Completed</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* problem desc */}
                    {problemData?.description && (
                      <div className="bg-base-100 rounded-xl shadow-sm p-5 border border-base-300">
                        <h2 className="text-xl font-bold mb-4 text-base-content">Description</h2>
                        <div className="space-y-3 text-base leading-relaxed">
                          {/* Description handling: check if it's an object (new structure) or string (old structure) */}
                          {typeof problemData.description === "object" ? (
                            <>
                              <p className="text-base-content/90">
                                {problemData.description.text}
                              </p>
                              {problemData.description.notes?.map((note, idx) => (
                                <p key={idx} className="text-base-content/90">
                                  {note}
                                </p>
                              ))}
                            </>
                          ) : (
                            <p className="text-base-content/90">{problemData.description}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* examples section */}
                    {problemData?.examples && problemData.examples.length > 0 && (
                      <div className="bg-base-100 rounded-xl shadow-sm p-5 border border-base-300">
                        <h2 className="text-xl font-bold mb-4 text-base-content">Examples</h2>

                        <div className="space-y-4">
                          {problemData.examples.map((example, idx) => {
                            // Helper to parse example_text if input/output fields are missing
                            const input =
                              example.input ||
                              example.example_text?.split("Input: ")?.[1]?.split("\n")?.[0] ||
                              "";
                            const output =
                              example.output ||
                              example.example_text?.split("Output: ")?.[1]?.split("\n")?.[0] ||
                              "";
                            const explanation =
                              example.explanation ||
                              example.example_text?.split("Explanation: ")?.[1] ||
                              "";

                            return (
                              <div key={idx}>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="badge badge-sm">{idx + 1}</span>
                                  <p className="font-semibold text-base-content">
                                    Example {idx + 1}
                                  </p>
                                </div>
                                <div className="bg-base-200 rounded-lg p-4 font-mono text-sm space-y-1.5">
                                  <div className="flex gap-2">
                                    <span className="text-primary font-bold min-w-[70px]">
                                      Input:
                                    </span>
                                    <span>{input}</span>
                                  </div>
                                  <div className="flex gap-2">
                                    <span className="text-secondary font-bold min-w-[70px]">
                                      Output:
                                    </span>
                                    <span>{output}</span>
                                  </div>
                                  {explanation && (
                                    <div className="pt-2 border-t border-base-300 mt-2">
                                      <span className="text-base-content/60 font-sans text-xs">
                                        <span className="font-semibold">Explanation:</span>{" "}
                                        {explanation}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Constraints */}
                    {problemData?.constraints && problemData.constraints.length > 0 && (
                      <div className="bg-base-100 rounded-xl shadow-sm p-5 border border-base-300">
                        <h2 className="text-xl font-bold mb-4 text-base-content">Constraints</h2>
                        <ul className="space-y-2 text-base-content/90">
                          {problemData.constraints.map((constraint, idx) => (
                            <li key={idx} className="flex gap-2">
                              <span className="text-primary">•</span>
                              <code className="text-sm">{constraint}</code>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </Panel>

              <PanelResizeHandle className="h-2 bg-base-300 hover:bg-primary transition-colors cursor-row-resize" />

              <Panel defaultSize={50} minSize={20}>
                <PanelGroup direction="vertical">
                  <Panel defaultSize={70} minSize={30}>
                    <CodeEditor
                      selectedLanguage={selectedLanguage}
                      code={code}
                      isRunning={isRunning}
                      onLanguageChange={handleLanguageChange}
                      onCodeChange={(value) => setCode(value)}
                      onRunCode={handleRunCode}
                    />
                  </Panel>

                  <PanelResizeHandle className="h-2 bg-base-300 hover:bg-primary transition-colors cursor-row-resize" />

                  <Panel defaultSize={30} minSize={15}>
                    <OutputPanel output={output} />
                  </Panel>
                </PanelGroup>
              </Panel>
            </PanelGroup>
          </Panel>

          <PanelResizeHandle className="w-2 bg-base-300 hover:bg-primary transition-colors cursor-col-resize" />

          {/* RIGHT PANEL - VIDEO CALLS & CHAT */}
          <Panel defaultSize={50} minSize={30}>
            <div className="h-full bg-base-200 p-4 overflow-auto">
              {isMinimized ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center p-8 bg-base-100 rounded-2xl shadow-xl border border-dashed border-primary/30">
                    <Loader2Icon className="w-12 h-12 mx-auto animate-bounce text-primary mb-4" />
                    <h3 className="text-xl font-bold">Session is Minimized</h3>
                    <p className="text-base-content/60 mt-2">Check the floating window or click below to expand</p>
                    <button
                      onClick={() => setIsMinimized(false)}
                      className="btn btn-primary mt-6"
                    >
                      Expand Video
                    </button>
                  </div>
                </div>
              ) : isInitializingCall ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Loader2Icon className="w-12 h-12 mx-auto animate-spin text-primary mb-4" />
                    <p className="text-lg">Connecting to video call...</p>
                  </div>
                </div>
              ) : !streamClient || !call || joinError ? (
                <div className="h-full flex items-center justify-center">
                  <div className="card bg-base-100 shadow-xl max-w-md border border-error/20">
                    <div className="card-body items-center text-center">
                      <div className="w-24 h-24 bg-error/10 rounded-full flex items-center justify-center mb-4">
                        <PhoneOffIcon className="w-12 h-12 text-error" />
                      </div>
                      <h2 className="card-title text-2xl">Connection Failed</h2>
                      <p className="text-base-content/70 mb-6">
                        {joinError || "Unable to connect to the video call"}
                      </p>

                      <button
                        onClick={() => {
                          setJoinError(null);
                          joinSession(session, isHost, isParticipant);
                        }}
                        className="btn btn-primary w-full gap-2"
                      >
                        Retry Connection
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <StreamVideo client={streamClient}>
                  <StreamCall call={call}>
                    <div className="h-full">
                      <VideoCallUI chatClient={chatClient} channel={channel} />
                    </div>
                  </StreamCall>
                </StreamVideo>
              )}
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

export default SessionPage;