import { useUser } from "@clerk/clerk-react";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router";
import { useEndSession, useJoinSession, useSessionById, useAddProblemToSession } from "../hooks/useSessions";
import { PROBLEMS } from "../data/Problems";
import { executeCode } from "../lib/piston";
import Navbar from "../components/Navbar";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { getDifficultyBadgeClass } from "../lib/utils";
import { Loader2Icon, LogOutIcon, PhoneOffIcon, ShareIcon, ChevronLeftIcon, ChevronRightIcon, ListIcon, PlusIcon, VideoIcon, StopCircle } from "lucide-react";
import CodeEditor from "../components/CodeEditor";
import OutputPanel from "../components/OutputPanel";
import toast from "react-hot-toast";
import { sessionApi } from "../api/session";

import { StreamCall, StreamVideo } from "@stream-io/video-react-sdk";
import VideoCallUI from "../components/VideoCallUI";
import { useLiveSession } from "../context/LiveSessionContext";
import AddProblemModal from "../components/AddProblemModal";

function SessionPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useUser();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAddProblemOpen, setIsAddProblemOpen] = useState(false);
  const hasInitiatedJoin = useRef(false);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordingStreamRef = useRef(null);

  const { data: sessionData, isLoading: loadingSession, refetch } = useSessionById(id);
  const joinSessionMutation = useJoinSession();
  const endSessionMutation = useEndSession();
  const addProblemMutation = useAddProblemToSession();

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
    setJoinError,
    code,
    setCode,
    selectedLanguage,
    setSelectedLanguage,
    activeProblemIndex,
    switchProblem,
    executionResult: output,
    setExecutionResult: setOutput,
    isExecuting: isRunning,
    setIsExecuting: setIsRunning,
    isVideoMaximized,
    setIsVideoMaximized
  } = useLiveSession();

  const isInitializingCall = globalInitializing || loadingSession;

  // Combine fixed problems and custom problems into a single list
  const allProblems = useMemo(() => {
    if (!session) return [];
    const existing = (session.problems || []).map(title => 
      Object.values(PROBLEMS).find(p => p.title === title)
    ).filter(Boolean);
    const custom = session.customProblems || [];
    return [...existing, ...custom];
  }, [session]);

  const problemData = allProblems[activeProblemIndex];

  // Reset join flag when session ID changes
  useEffect(() => {
    hasInitiatedJoin.current = false;
  }, [id]);

  // ===== AUTO-JOIN SESSION =====
  useEffect(() => {
    if (!session || !user || loadingSession) return;
    if (isLive || isJoining || globalInitializing) return;
    if (hasInitiatedJoin.current) return;
    if (joinError) return;
    if (joinSessionMutation.isPending) return;

    hasInitiatedJoin.current = true;

    if (isHost || isParticipant) {
      joinSession(session, isHost, isParticipant);
    } else {
      joinSessionMutation.mutate(id, {
        onSuccess: async () => {
          const { data: refreshed } = await refetch();
          if (refreshed?.session) joinSession(refreshed.session, false, true);
          else hasInitiatedJoin.current = false;
        },
        onError: (error) => {
          hasInitiatedJoin.current = false;
          toast.error(error.response?.data?.message || "Failed to join session");
          navigate("/dashboard");
        }
      });
    }
  }, [session?._id, user?.id, loadingSession, isLive, isJoining, globalInitializing, joinError, isHost, isParticipant, id]);

  // Redirect if completed
  useEffect(() => {
    if (session?.status === "completed") navigate("/dashboard");
  }, [session, navigate]);

  // Initialize code if empty
  useEffect(() => {
    if (problemData?.starterCode?.[selectedLanguage] && !code) {
      setCode(problemData.starterCode[selectedLanguage]);
    }
  }, [problemData, selectedLanguage, code, setCode]);

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
    if (channel) {
        channel.sendEvent({ type: "code-run-start" });
    }
    setIsRunning(true);
    setOutput(null);
    const result = await executeCode(selectedLanguage, code);
    
    setOutput(result);
    setIsRunning(false);
    
    if (channel) {
        channel.sendEvent({ type: "code-run-result", result });
    }
  };

  useEffect(() => {
    if (!channel) return;
    const handleAddProblemEvent = (event) => {
      if (event.type === "problem-added") {
        refetch();
        toast.success("New problem added by host!");
      }
    };
    channel.on(handleAddProblemEvent);
    return () => channel.off(handleAddProblemEvent);
  }, [channel, refetch]);

  const handleAddProblem = async (problemData) => {
    addProblemMutation.mutate({ id, problemData }, {
      onSuccess: () => {
        setIsAddProblemOpen(false);
        refetch();
        if (channel) {
          channel.sendEvent({ type: "problem-added" });
        }
      }
    });
  };

  const handleEndSession = async () => {
    if (confirm("End this session?")) {
      await leaveSession();
      endSessionMutation.mutate(id, { onSuccess: () => navigate("/dashboard") });
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied!");
  };

  const handleRetry = useCallback(() => {
    setJoinError(null);
    hasInitiatedJoin.current = false;
  }, []);

  const startRecording = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      // Capture audio from microphone too if possible
      let combinedStream = screenStream;
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        const dest = audioContext.createMediaStreamDestination();
        let hasSystemAudio = screenStream.getAudioTracks().length > 0;
        
        if (hasSystemAudio) {
          const screenSource = audioContext.createMediaStreamSource(screenStream);
          screenSource.connect(dest);
        }
        
        const micSource = audioContext.createMediaStreamSource(audioStream);
        micSource.connect(dest);
        
        // Resume context if suspended (common browser policy)
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }

        const tracks = [
          ...screenStream.getVideoTracks(),
          ...dest.stream.getAudioTracks()
        ];
        combinedStream = new MediaStream(tracks);
      } catch (e) {
        console.log("Mic audio mixing failed, using screen stream only:", e);
      }

      recordingStreamRef.current = combinedStream;
      const mediaRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm; codecs=vp9' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        
        // Upload to backend
        const toastId = toast.loading("Uploading recording...");
        try {
          await sessionApi.uploadRecording(id, blob);
          toast.success("Recording saved!", { id: toastId });
        } catch (error) {
          console.error("Upload failed", error);
          toast.error("Failed to save recording", { id: toastId });
        }

        // Cleanup
        recordingStreamRef.current.getTracks().forEach(track => track.stop());
        setIsRecording(false);
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.success("Recording started");

      // Handle user stopping screen share via browser UI
      screenStream.getVideoTracks()[0].onended = () => {
        if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
      };

    } catch (err) {
      console.error("Error starting recording:", err);
      toast.error("Could not start recording");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  return (
    <div className="h-screen bg-base-100 flex flex-col overflow-hidden">
      <Navbar />

      <div className="flex-1 flex overflow-hidden">
        {/* PROBLEM SIDEBAR */}
        {!isVideoMaximized && (
          <div className={`transition-all duration-300 border-r border-base-300 bg-base-200 flex flex-col ${isSidebarOpen ? 'w-64' : 'w-0 overflow-hidden'}`}>
              <div className="p-4 border-b border-base-300 flex items-center justify-between bg-base-100">
                  <span className="font-bold text-sm uppercase tracking-wider text-base-content/60">Problems</span>
                  <div className="flex items-center gap-2">
                      {isHost && (
                          <button onClick={() => setIsAddProblemOpen(true)} className="btn btn-ghost btn-xs btn-circle bg-primary/10 hover:bg-primary/20 text-primary">
                              <PlusIcon className="size-4" />
                          </button>
                      )}
                      <ListIcon className="size-4 text-base-content/40"/>
                  </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {allProblems.map((p, idx) => (
                      <button
                          key={idx}
                          onClick={() => switchProblem(idx)}
                          className={`w-full text-left p-3 rounded-lg transition-all text-sm flex items-center gap-3 ${activeProblemIndex === idx ? 'bg-primary text-primary-content shadow-md' : 'hover:bg-base-300'}`}
                      >
                          <span className={`size-6 rounded-full flex items-center justify-center text-[10px] border ${activeProblemIndex === idx ? 'border-primary-content/30' : 'border-base-content/20'}`}>
                              {idx + 1}
                          </span>
                          <span className="truncate font-medium">{p.title}</span>
                      </button>
                  ))}
              </div>
          </div>
        )}

        {/* SIDEBAR TOGGLE BUTTON */}
        {!isVideoMaximized && (
          <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="absolute left-[244px] top-1/2 -translate-y-1/2 z-50 btn btn-circle btn-xs btn-primary shadow-lg transition-all"
              style={{ left: isSidebarOpen ? '244px' : '0px' }}
          >
              {isSidebarOpen ? <ChevronLeftIcon className="size-3"/> : <ChevronRightIcon className="size-3"/>}
          </button>
        )}

        <div className="flex-1 relative overflow-hidden">
        <PanelGroup direction="horizontal">
          {!isVideoMaximized && (
            <>
              <Panel defaultSize={50} minSize={30}>
                <PanelGroup direction="vertical">
                  <Panel defaultSize={50} minSize={20}>
                    <div className="h-full overflow-y-auto bg-base-200">
                      <div className="p-6 bg-base-100 border-b border-base-300">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="badge badge-outline badge-sm font-bold uppercase tracking-tight opacity-50">Live Session</span>
                                <span className="text-sm font-bold text-primary">{session?.title || "Active Session"}</span>
                            </div>
                            <h1 className="text-3xl font-bold text-base-content">
                              {problemData?.title || "Loading..."}
                            </h1>
                            <p className="text-base-content/60 mt-1">
                              {problemData?.category || (problemData?.difficulty && `Difficulty: ${problemData.difficulty}`)}
                            </p>
                            <p className="text-base-content/60 mt-2">
                              Host: {session?.host?.name || "..."}
                              {session?.participant && <> • Guest: {session.participant.name}</>}
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <button onClick={handleShare} className="btn btn-ghost btn-sm gap-2">
                                <ShareIcon className="w-4 h-4" /> Share
                            </button>
                            {isHost && (
                                <button onClick={handleEndSession} className="btn btn-error btn-sm gap-2 whitespace-nowrap">
                                    <LogOutIcon className="w-4 h-4" /> End
                                </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="p-6 space-y-6">
                        {problemData?.description && (
                          <div className="bg-base-100 rounded-xl shadow-sm p-6 border border-base-300 prose prose-sm max-w-none">
                            <h2 className="text-xl font-bold mb-4">Description</h2>
                            {typeof problemData.description === "object" ? (
                                <div className="space-y-4">
                                    <p className="text-base-content/90 whitespace-pre-wrap">{problemData.description.text}</p>
                                    {problemData.description.notes?.map((note, idx) => (
                                        <div key={idx} className="bg-base-200/50 p-3 rounded-lg border-l-4 border-primary">
                                            <p className="text-sm italic">{note}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-base-content/90 whitespace-pre-wrap">{problemData.description}</p>
                            )}
                          </div>
                        )}
                        
                        {problemData?.examples && problemData.examples.length > 0 && (
                          <div className="bg-base-100 rounded-xl shadow-sm p-6 border border-base-300">
                            <h2 className="text-xl font-bold mb-4">Examples</h2>
                            <div className="grid gap-4">
                              {problemData.examples.map((example, idx) => (
                                <div key={idx} className="bg-base-200 rounded-lg overflow-hidden border border-base-300">
                                  <div className="px-4 py-2 bg-base-300/50 border-b border-base-300 text-xs font-bold uppercase tracking-wider">Example {idx + 1}</div>
                                  <div className="p-4 font-mono text-sm space-y-2">
                                    {example.example_text ? (
                                      <div className="whitespace-pre-wrap">{example.example_text}</div>
                                    ) : (
                                      <>
                                        <div className="flex gap-4"><span className="text-primary font-bold">Input:</span><span className="break-all">{example.input || "None"}</span></div>
                                        <div className="flex gap-4"><span className="text-secondary font-bold">Output:</span><span className="break-all">{example.output || "None"}</span></div>
                                      </>
                                    )}
                                    {example.explanation && <div className="mt-2 text-xs text-base-content/60 italic">{example.explanation}</div>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {problemData?.constraints && problemData.constraints.length > 0 && (
                          <div className="bg-base-100 rounded-xl shadow-sm p-6 border border-base-300">
                            <h2 className="text-xl font-bold mb-4">Constraints</h2>
                            <ul className="list-disc list-inside space-y-2">
                              {problemData.constraints.map((constraint, idx) => (
                                <li key={idx} className="text-sm text-base-content/80 font-mono">
                                  {constraint}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </Panel>

                  <PanelResizeHandle className="h-2 bg-base-300 hover:bg-primary transition-colors cursor-row-resize shadow-inner" />

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
                      <PanelResizeHandle className="h-2 bg-base-300 hover:bg-primary transition-colors cursor-row-resize shadow-inner" />
                      <Panel defaultSize={30} minSize={15}>
                        <OutputPanel output={output} />
                      </Panel>
                    </PanelGroup>
                  </Panel>
                </PanelGroup>
              </Panel>

              <PanelResizeHandle className="w-2 bg-base-300 hover:bg-primary transition-colors cursor-col-resize shadow-inner" />
            </>
          )}

          <Panel defaultSize={isVideoMaximized ? 100 : 50} minSize={30}>
            <div className="h-full bg-base-200 p-4 overflow-auto">
              {isMinimized ? (
                <div className="h-full flex items-center justify-center animate-in fade-in zoom-in">
                  <div className="text-center p-12 bg-base-100 rounded-3xl shadow-2xl border border-dashed border-primary/30">
                    <Loader2Icon className="w-16 h-16 mx-auto animate-bounce text-primary mb-6" />
                    <h3 className="text-2xl font-black">Video Minimized</h3>
                    <p className="text-base-content/50 mt-2 max-w-xs">The interview continues in the floating window.</p>
                    <button onClick={() => setIsMinimized(false)} className="btn btn-primary btn-lg mt-8 rounded-full shadow-lg hover:shadow-primary/30">
                      Bring Back Video
                    </button>
                  </div>
                </div>
              ) : isInitializingCall ? (
                <div className="h-full flex flex-col items-center justify-center gap-4">
                  <Loader2Icon className="w-12 h-12 animate-spin text-primary" />
                  <p className="text-base-content/60 font-medium">Connecting to secure stream...</p>
                </div>
              ) : joinError ? (
                <div className="h-full flex items-center justify-center p-6">
                  <div className="card bg-base-100 shadow-2xl max-w-md border border-error/20 overflow-hidden">
                    <div className="h-2 bg-error"></div>
                    <div className="card-body items-center text-center p-10">
                      <div className="w-20 h-20 bg-error/10 rounded-full flex items-center justify-center mb-6">
                        <PhoneOffIcon className="w-10 h-10 text-error" />
                      </div>
                      <h2 className="card-title text-2xl font-bold">Unable to Connect</h2>
                      <p className="text-base-content/60 mb-8">{joinError}</p>
                      <button onClick={handleRetry} className="btn btn-error btn-block gap-2 shadow-lg shadow-error/20">
                        Try Again
                      </button>
                    </div>
                  </div>
                </div>
              ) : !streamClient || !call ? (
                <div className="h-full flex flex-col items-center justify-center gap-4">
                  <Loader2Icon className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm font-medium tracking-wide">Finalizing setup...</p>
                </div>
              ) : (
                <StreamVideo client={streamClient}>
                  <StreamCall call={call}>
                    <div className="h-full rounded-2xl overflow-hidden shadow-2xl bg-black border border-base-300">
                      <VideoCallUI 
                        chatClient={chatClient} 
                        channel={channel} 
                        isRecording={isRecording}
                        startRecording={startRecording}
                        stopRecording={stopRecording}
                      />
                    </div>
                  </StreamCall>
                </StreamVideo>
              )}
            </div>
          </Panel>
        </PanelGroup>
        </div>
      </div>
      <AddProblemModal 
        isOpen={isAddProblemOpen} 
        onClose={() => setIsAddProblemOpen(false)} 
        onAddProblem={handleAddProblem}
        isAdding={addProblemMutation.isPending}
      />
    </div>
  );
}

export default SessionPage;