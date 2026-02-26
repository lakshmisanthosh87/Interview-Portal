import { createContext, useContext, useState, useEffect } from "react";
import { StreamChat } from "stream-chat";
import toast from "react-hot-toast";
import { initializeStreamClient, disconnectStreamClient } from "../lib/stream";
import { sessionApi } from "../api/session";
import { useUser } from "@clerk/clerk-react";

const LiveSessionContext = createContext();

export const LiveSessionProvider = ({ children }) => {
    const { user, isLoaded: isUserLoaded } = useUser();
    const [activeSessionId, setActiveSessionId] = useState(() => localStorage.getItem("activeSessionId"));
    const [sessionData, setSessionData] = useState(null);
    const [isLive, setIsLive] = useState(false);
    const [isMinimized, setIsMinimized] = useState(() => localStorage.getItem("isMinimized") === "true");

    const [streamClient, setStreamClient] = useState(null);
    const [call, setCall] = useState(null);
    const [chatClient, setChatClient] = useState(null);
    const [channel, setChannel] = useState(null);
    const [isInitializingCall, setIsInitializingCall] = useState(false);

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

    // Auto-rejoin session on mount/auth
    useEffect(() => {
        const autoRejoin = async () => {
            if (!isUserLoaded || !user || !activeSessionId || isLive || isInitializingCall) return;

            try {
                const { session } = await sessionApi.getSessionById(activeSessionId);
                if (session && session.status === "active") {
                    const isHost = session.host?.clerkId === user.id;
                    const isParticipant = session.participant?.clerkId === user.id;

                    if (isHost || isParticipant) {
                        await joinSession(session, isHost, isParticipant);
                    } else {
                        // If user is no longer part of the session, clear it
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
    }, [isUserLoaded, user, activeSessionId, isLive]);

    const joinSession = async (session, isHost, isParticipant) => {
        if (!session?.callId) return;
        if (activeSessionId === session._id && isLive) return;

        setIsInitializingCall(true);
        setActiveSessionId(session._id);
        setSessionData(session);
        setIsLive(true);

        try {
            const { token, userId, userName, userImage } = await sessionApi.getStreamToken();

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
            const chatInstance = StreamChat.getInstance(apiKey);

            await chatInstance.connectUser(
                {
                    id: userId,
                    name: userName,
                    image: userImage,
                },
                token
            );
            setChatClient(chatInstance);

            const chatChannel = chatInstance.channel("messaging", session.callId);
            await chatChannel.watch();
            setChannel(chatChannel);
        } catch (error) {
            toast.error("Failed to join video call");
            console.error("Error init call", error);
            leaveSession();
        } finally {
            setIsInitializingCall(false);
        }
    };

    const leaveSession = async () => {
        try {
            if (call) await call.leave();
            if (chatClient) await chatClient.disconnectUser();
            await disconnectStreamClient();
        } catch (error) {
            console.error("Cleanup error:", error);
        } finally {
            setActiveSessionId(null);
            setSessionData(null);
            setIsLive(false);
            setIsMinimized(false);
            setStreamClient(null);
            setCall(null);
            setChatClient(null);
            setChannel(null);
            localStorage.removeItem("activeSessionId");
            localStorage.removeItem("isMinimized");
        }
    };

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
