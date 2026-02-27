import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { StreamChat } from "stream-chat";
import toast from "react-hot-toast";
import { initializeStreamClient, disconnectStreamClient } from "../lib/stream";
import { sessionApi } from "../api/session";
import { useUser } from "@clerk/clerk-react";

const LiveSessionContext = createContext();

export const LiveSessionProvider = ({ children }) => {
  const { user, isLoaded: isUserLoaded } = useUser();
  const tabId = useRef(Math.random().toString(36).slice(2));
  const isJoiningRef = useRef(false);

  const [activeSessionId, setActiveSessionId] = useState(() => localStorage.getItem("activeSessionId"));
  const [sessionData, setSessionData] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isMinimized, setIsMinimized] = useState(() => localStorage.getItem("isMinimized") === "true");

  const [streamClient, setStreamClient] = useState(null);
  const [call, setCall] = useState(null);
  const [chatClient, setChatClient] = useState(null);
  const [channel, setChannel] = useState(null);
  const [isInitializingCall, setIsInitializingCall] = useState(false);
  const [joinError, setJoinError] = useState(null);

  // Persistence State for Code Editor
  const [code, setCode] = useState(() => {
    const saved = localStorage.getItem(`code_${activeSessionId}`);
    return saved || "";
  });
  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    const saved = localStorage.getItem(`lang_${activeSessionId}`);
    return saved || "javascript";
  });

  // Refs for latest values in async functions (avoids stale closures)
  const callRef = useRef(null);
  const chatClientRef = useRef(null);
  const isLiveRef = useRef(false);
  const codeRef = useRef(code);
  const selectedLanguageRef = useRef(selectedLanguage);
  const lastUpdateRef = useRef(0);
  const isRemoteChange = useRef(false);

  useEffect(() => { callRef.current = call; }, [call]);
  useEffect(() => { chatClientRef.current = chatClient; }, [chatClient]);
  useEffect(() => { isLiveRef.current = isLive; }, [isLive]);
  useEffect(() => { codeRef.current = code; }, [code]);
  useEffect(() => { selectedLanguageRef.current = selectedLanguage; }, [selectedLanguage]);

  // Sync activeSessionId to localStorage
  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem("activeSessionId", activeSessionId);
    } else {
      localStorage.removeItem("activeSessionId");
    }
  }, [activeSessionId]);

  useEffect(() => {
    localStorage.setItem("isMinimized", isMinimized);
  }, [isMinimized]);

  // Persist code and language to localStorage
  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem(`code_${activeSessionId}`, code);
      localStorage.setItem(`lang_${activeSessionId}`, selectedLanguage);
    }
  }, [code, selectedLanguage, activeSessionId]);

  // Cross-tab sync
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "activeSessionId") setActiveSessionId(e.newValue);
      if (e.key === "isMinimized") setIsMinimized(e.newValue === "true");
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Real-time synchronization logic moved to Context
  useEffect(() => {
    if (!channel || !user) return;

    const handleEvent = (event) => {
      if (!event.user || event.user.id === user.id) return;

      if (event.type === "code-update") {
        if (event.timestamp > lastUpdateRef.current) {
          lastUpdateRef.current = event.timestamp;
          if (event.code !== codeRef.current) {
            console.log("[CodeSync] Context: Received remote code update");
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
      } else if (event.type === "request-sync" && sessionData?.host?.clerkId === user.id) {
        console.log("[CodeSync] Context: Sending state to requester");
        channel.sendEvent({
          type: "code-update",
          code: codeRef.current,
          language: selectedLanguageRef.current,
          timestamp: Date.now(),
        });
      }
    };

    channel.on(handleEvent);
    
    // Request initial sync if we are the participant just joining
    if (sessionData?.host?.clerkId !== user.id && isLive) {
      console.log("[CodeSync] Context: Participant requesting sync");
      channel.sendEvent({ type: "request-sync" });
    }

    return () => channel.off(handleEvent);
  }, [channel, user, isLive, sessionData]);

  // Debounced emission
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

  // Helper to clean up connection resources only
  const cleanupConnection = useCallback(async () => {
    try {
      if (callRef.current) {
        console.log("[LiveSession] Leaving video call...");
        await callRef.current.leave();
      }
    } catch (e) {
      console.error("[LiveSession] Error leaving call:", e);
    }
    try {
      if (chatClientRef.current?.userID) {
        console.log("[LiveSession] Disconnecting chat...");
        await chatClientRef.current.disconnectUser();
      }
    } catch (e) {
      console.error("[LiveSession] Error disconnecting chat:", e);
    }
    try {
      await disconnectStreamClient();
    } catch (e) {
      console.error("[LiveSession] Error disconnecting stream:", e);
    }
    setStreamClient(null);
    setCall(null);
    setChatClient(null);
    setChannel(null);
    setIsLive(false);
  }, []);

  const joinSession = useCallback(async (session, isHost, isParticipant) => {
    console.log("[LiveSession] joinSession called", {
      callId: session?.callId,
      sessionId: session?._id,
      isHost,
      isParticipant,
      isJoiningRef: isJoiningRef.current,
      isLive: isLiveRef.current
    });

    if (!session?.callId || !user?.id) {
      console.warn("[LiveSession] Missing callId or user. Aborting join.");
      return;
    }

    if (isJoiningRef.current) return;
    if (isLiveRef.current) return;

    isJoiningRef.current = true;
    setIsJoining(true);
    setIsInitializingCall(true);
    setJoinError(null);
    setActiveSessionId(session._id);
    setSessionData(session);

    // Initialize code from localStorage or reset if new session
    const savedCode = localStorage.getItem(`code_${session._id}`);
    const savedLang = localStorage.getItem(`lang_${session._id}`);
    if (savedCode) {
      setCode(savedCode);
    } else {
      setCode(""); // Reset for new session so SessionPage can set starter code
    }
    if (savedLang) {
      setSelectedLanguage(savedLang);
    } else {
      setSelectedLanguage("javascript");
    }

    // Clean up any existing connection first
    if (callRef.current) {
      await cleanupConnection();
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    try {
      const { token, userId, userName, userImage } = await sessionApi.getStreamToken();
      const client = await initializeStreamClient(
        { id: userId, name: userName, image: userImage },
        token
      );
      setStreamClient(client);

      const videoCall = client.call("default", session.callId);
      await videoCall.join({ create: true });
      setCall(videoCall);

      const apiKey = import.meta.env.VITE_STREAM_API_KEY;
      if (!apiKey) throw new Error("VITE_STREAM_API_KEY is not defined");

      const chatInstance = StreamChat.getInstance(apiKey);
      if (chatInstance.userID !== userId) {
        if (chatInstance.userID) await chatInstance.disconnectUser();
        await chatInstance.connectUser({ id: userId, name: userName, image: userImage }, token);
      }
      setChatClient(chatInstance);

      const chatChannel = chatInstance.channel("messaging", session.callId);
      await chatChannel.watch();
      setChannel(chatChannel);

      setIsLive(true);
    } catch (error) {
      console.error("[LiveSession] Error joining session:", error);
      setJoinError(error.message || "Failed to join video call");
      toast.error(error.message || "Failed to join video call");
      await cleanupConnection();
    } finally {
      setIsInitializingCall(false);
      setIsJoining(false);
      isJoiningRef.current = false;
    }
  }, [user, cleanupConnection]);

  const leaveSession = useCallback(async (isBackoff = false) => {
    if (!isBackoff && activeSessionId) {
      try {
        await sessionApi.leaveSession(activeSessionId);
      } catch (error) {
        console.error("[LiveSession] Failed to notify backend:", error.message);
      }
    }

    await cleanupConnection();

    // Clear local storage for this session if it's a final leave?
    // User asked "code state must persist", so maybe don't remove unless session completed
    if (!isBackoff && sessionData?.status === "completed") {
      localStorage.removeItem(`code_${activeSessionId}`);
      localStorage.removeItem(`lang_${activeSessionId}`);
    }

    setSessionData(null);
    setIsInitializingCall(false);
    setIsJoining(false);
    setIsMinimized(false);
    isJoiningRef.current = false;

    if (!isBackoff) {
      localStorage.removeItem("activeSessionId");
      localStorage.removeItem("isMinimized");
      setActiveSessionId(null);
    }
  }, [activeSessionId, cleanupConnection, sessionData]);

  // Cleanup on tab close
  useEffect(() => {
    const handleUnload = () => {
      if (callRef.current) {
        try { callRef.current.leave(); } catch (e) { /* ignore */ }
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("pagehide", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("pagehide", handleUnload);
    };
  }, []);

  return (
    <LiveSessionContext.Provider
      value={{
        activeSessionId,
        sessionData,
        isLive,
        isJoining,
        isMinimized,
        setIsMinimized,
        streamClient,
        call,
        chatClient,
        channel,
        isInitializingCall,
        joinError,
        setJoinError,
        joinSession,
        leaveSession,
        code,
        setCode,
        selectedLanguage,
        setSelectedLanguage,
      }}
    >
      {children}
    </LiveSessionContext.Provider>
  );
};

export const useLiveSession = () => {
  const context = useContext(LiveSessionContext);
  if (!context) {
    throw new Error("useLiveSession must be used within a LiveSessionProvider");
  }
  return context;
};
