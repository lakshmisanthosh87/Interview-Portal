import { useUser } from "@clerk/clerk-react";
import { useEffect, useState, useRef, useCallback } from "react";
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
  const hasInitiatedJoin = useRef(false);

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

  const problemData = session?.customProblemId
    ? session.customProblemId
    : (session?.problem ? Object.values(PROBLEMS).find((p) => p.title === session.problem) : null);

  const [selectedLanguage, setSelectedLanguage] = useState("javascript");
  const [code, setCode] = useState(problemData?.starterCode?.[selectedLanguage] || "");

  // Refs for code sync to avoid stale closures in event handlers
  const codeRef = useRef(code);
  const selectedLanguageRef = useRef(selectedLanguage);
  const lastUpdateRef = useRef(0);

  useEffect(() => { codeRef.current = code; }, [code]);
  useEffect(() => { selectedLanguageRef.current = selectedLanguage; }, [selectedLanguage]);

  // Reset join flag when session ID changes (navigated to a different session)
  useEffect(() => {
    hasInitiatedJoin.current = false;
  }, [id]);

  // ===== AUTO-JOIN SESSION =====
  // This is the ONLY place that initiates joining. Runs once when session data loads.
  useEffect(() => {
    if (!session || !user || loadingSession) return;
    if (isLive || isJoining || globalInitializing) return;
    if (hasInitiatedJoin.current) return;
    if (joinError) return;
    if (joinSessionMutation.isPending) return;

    // Mark that we've initiated a join to prevent re-triggering
    hasInitiatedJoin.current = true;

    console.log("[SessionPage] Auto-join triggered", { isHost, isParticipant, sessionId: session._id });

    if (isHost || isParticipant) {
      // Already registered as host or participant — join directly
      console.log("[SessionPage] Joining as", isHost ? "HOST" : "PARTICIPANT");
      joinSession(session, isHost, isParticipant);
    } else {
      // New guest — register with backend first
      console.log("[SessionPage] Registering as new guest with backend...");
      joinSessionMutation.mutate(id, {
        onSuccess: async () => {
          console.log("[SessionPage] Guest registration successful. Refetching session...");
          // Refetch to get populated session with participant data
          const { data: refreshed } = await refetch();
          if (refreshed?.session) {
            console.log("[SessionPage] Got populated session. Joining video call...");
            joinSession(refreshed.session, false, true);
          } else {
            console.error("[SessionPage] Refetch returned no session data");
            hasInitiatedJoin.current = false;
          }
        },
        onError: (error) => {
          console.error("[SessionPage] Guest registration failed:", error);
          hasInitiatedJoin.current = false;
          toast.error(error.response?.data?.message || "Failed to join session");
          navigate("/dashboard");
        }
      });
    }
  }, [session?._id, user?.id, loadingSession, isLive, isJoining, globalInitializing, joinError, isHost, isParticipant]);

  // Redirect when session is completed
  useEffect(() => {
    if (!session || loadingSession) return;
    if (session.status === "completed") navigate("/dashboard");
  }, [session, loadingSession, navigate]);

  // Initialize code from problem data
  useEffect(() => {
    if (problemData?.starterCode?.[selectedLanguage] && !code) {
      setCode(problemData.starterCode[selectedLanguage]);
    }
  }, [problemData, selectedLanguage, code]);

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setSelectedLanguage(newLang);
    const starterCode = problemData?.starterCode?.[newLang] || "";
    setCode(starterCode);
    setOutput(null);

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

  // ===== REAL-TIME CODE SYNC =====
  // Uses refs so the handler doesn't need to re-register on every keystroke
  useEffect(() => {
    if (!channel || !user) return;

    const handleEvent = (event) => {
      // Ignore our own events
      if (!event.user || event.user.id === user.id) return;

      if (event.type === "code-update") {
        if (event.timestamp > lastUpdateRef.current) {
          lastUpdateRef.current = event.timestamp;
          if (event.code !== codeRef.current) {
            console.log("[CodeSync] Received remote code update");
            isRemoteChange.current = true;
            setCode(event.code);
          }
          if (event.language && event.language !== selectedLanguageRef.current) {
            setSelectedLanguage(event.language);
          }
        }
      } else if (event.type === "language-update") {
        if (event.language !== selectedLanguageRef.current) {
          setSelectedLanguage(event.language);
          if (event.starterCode) {
            isRemoteChange.current = true;
            setCode(event.starterCode);
          }
        }
      } else if (event.type === "request-sync" && isHost) {
        console.log("[CodeSync] Sending current state to participant");
        channel.sendEvent({
          type: "code-update",
          code: codeRef.current,
          language: selectedLanguageRef.current,
          timestamp: Date.now(),
        });
      }
    };

    channel.on(handleEvent);

    // Participant requests initial sync from host
    if (!isHost && isLive) {
      console.log("[CodeSync] Requesting initial sync from host");
      channel.sendEvent({ type: "request-sync" });
    }

    return () => channel.off(handleEvent);
  }, [channel, user, isHost, isLive]);

  // Debounced code emission to other participant
  useEffect(() => {
    if (!channel || !user || !isLive) return;

    if (isRemoteChange.current) {
      isRemoteChange.current = false;
      return;
    }

    const timeout = setTimeout(() => {
      const now = Date.now();
      lastUpdateRef.current = now;
      channel.sendEvent({
        type: "code-update",
        code: code,
        language: selectedLanguage,
        timestamp: now,
      });
    }, 200);

    return () => clearTimeout(timeout);
  }, [code, channel, user, isLive, selectedLanguage]);

  const handleEndSession = async () => {
    if (confirm("Are you sure you want to end this session? All participants will be notified.")) {
      await leaveSession();
      endSessionMutation.mutate(id, { onSuccess: () => navigate("/dashboard") });
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Session link copied to clipboard!");
  };

  const handleRetry = useCallback(() => {
    console.log("[SessionPage] Retrying connection...");
    setJoinError(null);
    hasInitiatedJoin.current = false;
    // The useEffect will re-trigger now that joinError is cleared and hasInitiatedJoin is false
  }, [setJoinError]);

  return (
    <div className="h-screen bg-base-100 flex flex-col">
      <Navbar />

      <div className="flex-1">
        <PanelGroup direction="horizontal">
          {/* LEFT PANEL - CODE EDITOR & PROBLEM */}
          <Panel defaultSize={50} minSize={30}>
            <PanelGroup direction="vertical">
              <Panel defaultSize={50} minSize={20}>
                <div className="h-full overflow-y-auto bg-base-200">
                  {/* HEADER */}
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
                            <> • Waiting for participant...</>
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {session?.difficulty && (
                          <span className={`badge badge-lg ${getDifficultyBadgeClass(session.difficulty)}`}>
                            {session.difficulty.charAt(0).toUpperCase() + session.difficulty.slice(1)}
                          </span>
                        )}
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
                    {problemData?.description && (
                      <div className="bg-base-100 rounded-xl shadow-sm p-5 border border-base-300">
                        <h2 className="text-xl font-bold mb-4 text-base-content">Description</h2>
                        <div className="space-y-3 text-base leading-relaxed">
                          {typeof problemData.description === "object" ? (
                            <>
                              <p className="text-base-content/90">{problemData.description.text}</p>
                              {problemData.description.notes?.map((note, idx) => (
                                <p key={idx} className="text-base-content/90">{note}</p>
                              ))}
                            </>
                          ) : (
                            <p className="text-base-content/90">{problemData.description}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {problemData?.examples && problemData.examples.length > 0 && (
                      <div className="bg-base-100 rounded-xl shadow-sm p-5 border border-base-300">
                        <h2 className="text-xl font-bold mb-4 text-base-content">Examples</h2>
                        <div className="space-y-4">
                          {problemData.examples.map((example, idx) => {
                            const input = example.input || example.example_text?.split("Input: ")?.[1]?.split("\n")?.[0] || "";
                            const exOutput = example.output || example.example_text?.split("Output: ")?.[1]?.split("\n")?.[0] || "";
                            const explanation = example.explanation || example.example_text?.split("Explanation: ")?.[1] || "";
                            return (
                              <div key={idx}>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="badge badge-sm">{idx + 1}</span>
                                  <p className="font-semibold text-base-content">Example {idx + 1}</p>
                                </div>
                                <div className="bg-base-200 rounded-lg p-4 font-mono text-sm space-y-1.5">
                                  <div className="flex gap-2">
                                    <span className="text-primary font-bold min-w-[70px]">Input:</span>
                                    <span>{input}</span>
                                  </div>
                                  <div className="flex gap-2">
                                    <span className="text-secondary font-bold min-w-[70px]">Output:</span>
                                    <span>{exOutput}</span>
                                  </div>
                                  {explanation && (
                                    <div className="pt-2 border-t border-base-300 mt-2">
                                      <span className="text-base-content/60 font-sans text-xs">
                                        <span className="font-semibold">Explanation:</span> {explanation}
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

          {/* RIGHT PANEL - VIDEO & CHAT */}
          <Panel defaultSize={50} minSize={30}>
            <div className="h-full bg-base-200 p-4 overflow-auto">
              {isMinimized ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center p-8 bg-base-100 rounded-2xl shadow-xl border border-dashed border-primary/30">
                    <Loader2Icon className="w-12 h-12 mx-auto animate-bounce text-primary mb-4" />
                    <h3 className="text-xl font-bold">Session is Minimized</h3>
                    <p className="text-base-content/60 mt-2">Check the floating window or click below to expand</p>
                    <button onClick={() => setIsMinimized(false)} className="btn btn-primary mt-6">
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
              ) : joinError ? (
                <div className="h-full flex items-center justify-center">
                  <div className="card bg-base-100 shadow-xl max-w-md border border-error/20">
                    <div className="card-body items-center text-center">
                      <div className="w-24 h-24 bg-error/10 rounded-full flex items-center justify-center mb-4">
                        <PhoneOffIcon className="w-12 h-12 text-error" />
                      </div>
                      <h2 className="card-title text-2xl">Connection Failed</h2>
                      <p className="text-base-content/70 mb-6">{joinError}</p>
                      <button onClick={handleRetry} className="btn btn-primary w-full gap-2">
                        Retry Connection
                      </button>
                    </div>
                  </div>
                </div>
              ) : !streamClient || !call ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Loader2Icon className="w-12 h-12 mx-auto animate-spin text-primary mb-4" />
                    <p className="text-lg">Setting up video call...</p>
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