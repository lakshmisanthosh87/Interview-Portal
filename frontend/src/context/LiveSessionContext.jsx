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

  // Use refs for latest values in async functions (avoids stale closures)
  const callRef = useRef(null);
  const chatClientRef = useRef(null);
  const isLiveRef = useRef(false);

  useEffect(() => { callRef.current = call; }, [call]);
  useEffect(() => { chatClientRef.current = chatClient; }, [chatClient]);
  useEffect(() => { isLiveRef.current = isLive; }, [isLive]);

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

  // Cross-tab sync
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "activeSessionId") setActiveSessionId(e.newValue);
      if (e.key === "isMinimized") setIsMinimized(e.newValue === "true");
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

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

    // Guard against parallel joins
    if (isJoiningRef.current) {
      console.log("[LiveSession] Already joining. Skipping.");
      return;
    }

    // Already live on this session
    if (isLiveRef.current) {
      console.log("[LiveSession] Already live. Skipping.");
      return;
    }

    isJoiningRef.current = true;
    setIsJoining(true);
    setIsInitializingCall(true);
    setJoinError(null);
    setActiveSessionId(session._id);
    setSessionData(session);

    // Clean up any existing connection first
    if (callRef.current) {
      console.log("[LiveSession] Cleaning up old call before new join...");
      await cleanupConnection();
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    try {
      // 1. Get Stream token from backend
      console.log("[LiveSession] Step 1: Fetching Stream token...");
      const { token, userId, userName, userImage } = await sessionApi.getStreamToken();
      console.log(`[LiveSession] Token received for ${userName} (${userId})`);

      // 2. Initialize Stream Video client
      console.log("[LiveSession] Step 2: Initializing Stream Video client...");
      const client = await initializeStreamClient(
        { id: userId, name: userName, image: userImage },
        token
      );
      setStreamClient(client);

      // 3. Join the video call
      console.log(`[LiveSession] Step 3: Joining video call '${session.callId}'...`);
      const videoCall = client.call("default", session.callId);
      await videoCall.join({ create: true });
      console.log("[LiveSession] Video call joined successfully!");
      setCall(videoCall);

      // 4. Initialize Stream Chat
      console.log("[LiveSession] Step 4: Initializing Stream Chat...");
      const apiKey = import.meta.env.VITE_STREAM_API_KEY;
      if (!apiKey) throw new Error("VITE_STREAM_API_KEY is not defined");

      const chatInstance = StreamChat.getInstance(apiKey);
      if (chatInstance.userID !== userId) {
        if (chatInstance.userID) {
          await chatInstance.disconnectUser();
        }
        await chatInstance.connectUser(
          { id: userId, name: userName, image: userImage },
          token
        );
      }
      setChatClient(chatInstance);

      // 5. Join the chat channel
      console.log(`[LiveSession] Step 5: Joining chat channel '${session.callId}'...`);
      const chatChannel = chatInstance.channel("messaging", session.callId);
      await chatChannel.watch();
      setChannel(chatChannel);

      console.log("[LiveSession] ✅ All connections established! Session is LIVE.");
      setIsLive(true);
    } catch (error) {
      console.error("[LiveSession] ❌ Error joining session:", error);
      setJoinError(error.message || "Failed to join video call");
      toast.error(error.message || "Failed to join video call");

      // Clean up partial resources but keep activeSessionId for retry
      await cleanupConnection();
    } finally {
      setIsInitializingCall(false);
      setIsJoining(false);
      isJoiningRef.current = false;
    }
  }, [user, cleanupConnection]);

  const leaveSession = useCallback(async (isBackoff = false) => {
    console.log(`[LiveSession] ${isBackoff ? "Backing off" : "Leaving"} session...`);

    if (!isBackoff && activeSessionId) {
      try {
        await sessionApi.leaveSession(activeSessionId);
      } catch (error) {
        console.error("[LiveSession] Failed to notify backend:", error.message);
      }
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
