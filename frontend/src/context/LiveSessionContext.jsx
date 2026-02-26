import { createContext, useContext, useState, useEffect, useRef } from "react";
import { StreamChat } from "stream-chat";
import toast from "react-hot-toast";
import { initializeStreamClient, disconnectStreamClient } from "../lib/stream";
import { sessionApi } from "../api/session";
import { useUser } from "@clerk/clerk-react";
import { StreamVideo, StreamCall } from "@stream-io/video-react-sdk";

const LiveSessionContext = createContext();

export const LiveSessionProvider = ({ children }) => {
  const { user, isLoaded: isUserLoaded } = useUser();
  const tabId = useRef(Math.random().toString(36).slice(2)); // Added for tab-lock
  
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

    // Sync state to localStorage
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

    // Handle cross-tab sync
    useEffect(() => {
        const handleStorageChange = (e) => {
            if (e.key === "activeSessionId") {
                setActiveSessionId(e.newValue);
            }
            if (e.key === "isMinimized") {
                setIsMinimized(e.newValue === "true");
            }
        };
        window.addEventListener("storage", handleStorageChange);
        return () => window.removeEventListener("storage", handleStorageChange);
    }, []);

    // Monitor tab ownership: if another tab steals the session lock, this tab should back off
    useEffect(() => {
        const checkOwnership = (e) => {
            if (!activeSessionId || !user?.id) return;
            const lockKey = `session_owner_${activeSessionId}_${user.id}`;
            
            if (e.key === lockKey && e.newValue && e.newValue !== tabId.current) {
                if (isLive) {
                    console.log("[LiveSession] Ownership moved to another tab. Backing off safely.");
                    leaveSession(true); // Safely back off locally
                }
            }
        };
        window.addEventListener("storage", checkOwnership);
        return () => window.removeEventListener("storage", checkOwnership);
    }, [activeSessionId, user, isLive]);

  // Auto-rejoin session on mount/auth
  useEffect(() => {
    const autoRejoin = async () => {
      if (!isUserLoaded || !user || !activeSessionId || isLive || isJoining || isInitializingCall) return;

      const isOnSessionPage = window.location.pathname.startsWith("/session/");
      
      // Only auto-rejoin in background if it's already minimized
      // OR if we are literally on the session page
      if (!isMinimized && !isOnSessionPage) return;

      try {
        const { session } = await sessionApi.getSessionById(activeSessionId);
        if (session && session.status === "active") {
          const isHost = session.host?.clerkId === user.id;
          const isParticipant = session.participant?.clerkId === user.id;
          
          if (isHost || isParticipant) {
             await joinSession(session, isHost, isParticipant);
          } else {
             leaveSession();
          }
        } else {
          leaveSession();
        }
      } catch (error) {
        console.error("Auto-rejoin failed:", error);
        leaveSession();
      }
    };

    autoRejoin();
  }, [isUserLoaded, user, activeSessionId, isLive, isJoining, isMinimized]);

    const joinSession = async (session, isHost, isParticipant) => {
        if (!session?.callId || !user?.id) return;
        if ((activeSessionId === session._id && isLive) || isJoining || isInitializingCall) return;

        // Ensure we clean up any old call before joining a new one
        if (call) {
           console.log("[LiveSession] Cleaning up existing call before new join...");
           try {
              await call.leave();
              setCall(null);
              // Safety delay for same-tab hardware release
              await new Promise(resolve => setTimeout(resolve, 500));
           } catch (e) {
              console.error("[LiveSession] Error leaving old call", e);
           }
        }

        // Tab-lock: only one tab per UNIQUE USER per session
        const lockKey = `session_owner_${session._id}_${user?.id}`;
        const currentOwner = localStorage.getItem(lockKey);
        const isOnSessionPage = window.location.pathname.includes(`/session/${session._id}`);

        if (currentOwner && currentOwner !== tabId.current) {
           if (isOnSessionPage) {
              console.log("[LiveSession] Session page taking priority. Waiting for other tab to release camera...");
              localStorage.setItem(lockKey, tabId.current);
              // Small delay to allow previous tab to call call.leave() and release hardware
              await new Promise(resolve => setTimeout(resolve, 1000)); 
           } else {
              console.log("[LiveSession] Another tab owns this session. Skipping join.");
              return;
           }
        } else {
            localStorage.setItem(lockKey, tabId.current);
        }

        setIsJoining(true);
        setIsInitializingCall(true);
        setJoinError(null); // Reset error on new attempt
        setActiveSessionId(session._id);
        setSessionData(session);
        // setIsLive(true) moved to after successful connection

        try {
            console.log(`[LiveSession] Fetching token for user ${user?.id}...`);
            const { token, userId, userName, userImage } = await sessionApi.getStreamToken();
            console.log(`[LiveSession] Token received. Initializing client for ${userName}...`);

            const client = await initializeStreamClient(
                {
                    id: userId,
                    name: userName,
                    image: userImage,
                },
                token
            );

            setStreamClient(client);

            const videoCall = client.call("default", session.callId);
            await videoCall.join({ create: true });
            setCall(videoCall);

            const apiKey = import.meta.env.VITE_STREAM_API_KEY;
            if (!apiKey) throw new Error("VITE_STREAM_API_KEY is not defined in environment variables");
            const chatInstance = StreamChat.getInstance(apiKey);

            if (chatInstance.userID !== userId) {
                if (chatInstance.userID) {
                    await chatInstance.disconnectUser();
                }
                await chatInstance.connectUser(
                    {
                        id: userId,
                        name: userName,
                        image: userImage,
                    },
                    token
                );
            }
            setChatClient(chatInstance);

            const chatChannel = chatInstance.channel("messaging", session.callId);
            await chatChannel.watch();
            setChannel(chatChannel);

            setIsLive(true); // Only set live once everything is ready
        } catch (error) {
            setJoinError(error.message || "Failed to join video call");
            toast.error(error.message || "Failed to join video call");
            console.error("Error init call", error);
            leaveSession();
        } finally {
            setIsInitializingCall(false);
            setIsJoining(false);
        }
    };

  const leaveSession = async (isBackoff = false) => {
    console.log(`[LiveSession] ${isBackoff ? "Backing off" : "Leaving"} session...`);
    try {
      if (call) await call.leave();
      if (chatClient) await chatClient.disconnectUser();
      await disconnectStreamClient();
    } catch (error) {
      console.error("[LiveSession] Cleanup error:", error);
    } finally {
      setIsLive(false);
      setIsInitializingCall(false);
      setIsJoining(false);
      setIsMinimized(false);
      setStreamClient(null);
      setCall(null);
      setChatClient(null);
      setChannel(null);
      setSessionData(null);
      
      if (!isBackoff) {
        setActiveSessionId(null);
        localStorage.removeItem("activeSessionId");
        localStorage.removeItem("isMinimized");
        if (sessionData?._id && user?.id) {
          localStorage.removeItem(`session_owner_${sessionData._id}_${user.id}`);
        }
      }
    }
  };

    // Immediate cleanup on tab close to prevent "ghost" participants
    useEffect(() => {
        const handleUnload = () => {
            if (sessionData?._id && user?.id) {
                const lockKey = `session_owner_${sessionData._id}_${user.id}`;
                if (localStorage.getItem(lockKey) === tabId.current) {
                    localStorage.removeItem(lockKey);
                }
            }
            if (call) {
                call.leave();
            }
        };
        window.addEventListener("beforeunload", handleUnload);
        return () => window.removeEventListener("beforeunload", handleUnload);
    }, [call]);

  return (
    <LiveSessionContext.Provider
      value={{
        activeSessionId,
        sessionData,
        isLive,
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
