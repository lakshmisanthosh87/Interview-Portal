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

  // Persistence State for Code Editor (Per Problem)
  const [activeProblemIndex, setActiveProblemIndex] = useState(0);
  const [code, setCode] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("javascript");

  // Refs for latest values
  const callRef = useRef(null);
  const chatClientRef = useRef(null);
  const isLiveRef = useRef(false);
  const codeRef = useRef(code);
  const selectedLanguageRef = useRef(selectedLanguage);
  const activeProblemIndexRef = useRef(activeProblemIndex);
  const lastUpdateRef = useRef(0);
  const isRemoteChange = useRef(false);

  useEffect(() => { callRef.current = call; }, [call]);
  useEffect(() => { chatClientRef.current = chatClient; }, [chatClient]);
  useEffect(() => { isLiveRef.current = isLive; }, [isLive]);
  useEffect(() => { codeRef.current = code; }, [code]);
  useEffect(() => { selectedLanguageRef.current = selectedLanguage; }, [selectedLanguage]);
  useEffect(() => { activeProblemIndexRef.current = activeProblemIndex; }, [activeProblemIndex]);

  // Persistent storage key helper
  const getStorageKey = useCallback((sessionId, index, type) => {
    return `${type}_${sessionId}_p${index}`;
  }, []);

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
      localStorage.setItem(getStorageKey(activeSessionId, activeProblemIndex, "code"), code);
      localStorage.setItem(getStorageKey(activeSessionId, activeProblemIndex, "lang"), selectedLanguage);
    }
  }, [code, selectedLanguage, activeSessionId, activeProblemIndex, getStorageKey]);

  // Function to switch problem
  const switchProblem = useCallback(async (index) => {
    if (!activeSessionId) return;
    
    // If we are participant (host or guest), notify backend and others
    const isHost = sessionData?.host?.clerkId === user?.id;
    const isParticipant = sessionData?.participant?.clerkId === user?.id;
    
    if (isHost || isParticipant) {
      try {
        await sessionApi.updateActiveProblem(activeSessionId, index);
        if (channel) {
          channel.sendEvent({
            type: "problem-switch",
            index,
            userId: user.id
          });
        }
      } catch (err) {
        console.error("Failed to update active problem on server:", err);
      }
    }

    // Load code for the new problem
    const savedCode = localStorage.getItem(getStorageKey(activeSessionId, index, "code"));
    const savedLang = localStorage.getItem(getStorageKey(activeSessionId, index, "lang"));
    
    setActiveProblemIndex(index);
    if (savedCode !== null) setCode(savedCode);
    else setCode(""); // SessionPage will set starter code
    if (savedLang !== null) setSelectedLanguage(savedLang);
    else setSelectedLanguage("javascript");
    
    lastUpdateRef.current = Date.now();
  }, [activeSessionId, channel, user, sessionData, getStorageKey]);

  // Real-time synchronization logic
  useEffect(() => {
    if (!channel || !user) return;

    const handleEvent = (event) => {
      if (!event.user || event.user.id === user.id) return;

      if (event.type === "code-update") {
        if (event.timestamp > lastUpdateRef.current) {
          lastUpdateRef.current = event.timestamp;
          if (event.code !== codeRef.current) {
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
      } else if (event.type === "problem-switch") {
        console.log("[CodeSync] Received problem-switch to index", event.index);
        const index = event.index;
        const savedCode = localStorage.getItem(getStorageKey(activeSessionId, index, "code"));
        const savedLang = localStorage.getItem(getStorageKey(activeSessionId, index, "lang"));
        
        setActiveProblemIndex(index);
        if (savedCode !== null) setCode(savedCode);
        else setCode("");
        if (savedLang !== null) setSelectedLanguage(savedLang);
        else setSelectedLanguage("javascript");
        
        lastUpdateRef.current = Date.now();
      } else if (event.type === "request-sync" && sessionData?.host?.clerkId === user.id) {
        channel.sendEvent({
          type: "code-update",
          code: codeRef.current,
          language: selectedLanguageRef.current,
          activeProblemIndex: activeProblemIndexRef.current,
          timestamp: Date.now(),
        });
      }
    };

    channel.on(handleEvent);
    
    if (sessionData?.host?.clerkId !== user.id && isLive) {
      channel.sendEvent({ type: "request-sync" });
    }

    return () => channel.off(handleEvent);
  }, [channel, user, isLive, sessionData, activeSessionId, getStorageKey]);

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
        activeProblemIndex: activeProblemIndex,
        timestamp: now,
      });
    }, 200);

    return () => clearTimeout(timeout);
  }, [code, channel, user, isLive, selectedLanguage, activeProblemIndex]);

  const cleanupConnection = useCallback(async () => {
    try { if (callRef.current) await callRef.current.leave(); } catch (e) {}
    try { if (chatClientRef.current?.userID) await chatClientRef.current.disconnectUser(); } catch (e) {}
    try { await disconnectStreamClient(); } catch (e) {}
    setStreamClient(null);
    setCall(null);
    setChatClient(null);
    setChannel(null);
    setIsLive(false);
  }, []);

  const joinSession = useCallback(async (session, isHost, isParticipant) => {
    if (!session?.callId || !user?.id) return;
    if (isJoiningRef.current || isLiveRef.current) return;

    isJoiningRef.current = true;
    setIsJoining(true);
    setIsInitializingCall(true);
    setJoinError(null);
    setActiveSessionId(session._id);
    setSessionData(session);
    setActiveProblemIndex(session.activeProblemIndex || 0);

    const savedCode = localStorage.getItem(getStorageKey(session._id, session.activeProblemIndex || 0, "code"));
    const savedLang = localStorage.getItem(getStorageKey(session._id, session.activeProblemIndex || 0, "lang"));
    
    if (savedCode) setCode(savedCode);
    else setCode("");
    if (savedLang) setSelectedLanguage(savedLang);
    else setSelectedLanguage("javascript");

    if (callRef.current) {
      await cleanupConnection();
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    try {
      const { token, userId, userName, userImage } = await sessionApi.getStreamToken();
      const client = await initializeStreamClient({ id: userId, name: userName, image: userImage }, token);
      setStreamClient(client);

      const videoCall = client.call("default", session.callId);
      await videoCall.join({ create: true });
      setCall(videoCall);

      const apiKey = import.meta.env.VITE_STREAM_API_KEY;
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
      setJoinError(error.message || "Failed to join video call");
      toast.error(error.message || "Failed to join video call");
      await cleanupConnection();
    } finally {
      setIsInitializingCall(false);
      setIsJoining(false);
      isJoiningRef.current = false;
    }
  }, [user, cleanupConnection, getStorageKey]);

  const leaveSession = useCallback(async (isBackoff = false) => {
    if (!isBackoff && activeSessionId) {
      try { await sessionApi.leaveSession(activeSessionId); } catch (error) {}
    }
    await cleanupConnection();
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
  }, [activeSessionId, cleanupConnection]);

  // Cross-tab sync
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "activeSessionId") setActiveSessionId(e.newValue);
      if (e.key === "isMinimized") setIsMinimized(e.newValue === "true");
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
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
        activeProblemIndex,
        switchProblem
      }}
    >
      {children}
    </LiveSessionContext.Provider>
  );
};

export const useLiveSession = () => {
  const context = useContext(LiveSessionContext);
  if (!context) throw new Error("useLiveSession must be used within a LiveSessionProvider");
  return context;
};
