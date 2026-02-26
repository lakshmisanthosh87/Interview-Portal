import { useRef } from "react";
import Draggable from "react-draggable";
import { useLiveSession } from "../context/LiveSessionContext";
import { StreamCall, StreamVideo } from "@stream-io/video-react-sdk";
import { Maximize2Icon, PhoneOffIcon } from "lucide-react";
import VideoCallUI from "./VideoCallUI";
import { useNavigate } from "react-router";

const FloatingVideoCall = () => {
    const nodeRef = useRef(null);
    const {
        isLive,
        isMinimized,
        setIsMinimized,
        streamClient,
        call,
        chatClient,
        channel,
        activeSessionId,
        leaveSession
    } = useLiveSession();

    const navigate = useNavigate();

    if (!isLive || !isMinimized || !streamClient || !call) return null;

    const handleExpand = () => {
        setIsMinimized(false);
        navigate(`/session/${activeSessionId}`);
    };

    return (
        <StreamVideo client={streamClient}>
            <StreamCall call={call}>
                <Draggable nodeRef={nodeRef} bounds="body">
                    <div ref={nodeRef} className="fixed bottom-5 right-5 w-80 h-60 bg-base-300 rounded-xl shadow-2xl z-[9999] overflow-hidden flex flex-col border border-primary/20 group">
                        <div className="bg-base-100 p-2 flex items-center justify-between border-b border-base-300">
                            <span className="text-xs font-bold truncate px-2">Live Interview</span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={handleExpand}
                                    className="btn btn-ghost btn-xs btn-square"
                                    title="Expand"
                                >
                                    <Maximize2Icon className="size-3" />
                                </button>
                                <button
                                    onClick={leaveSession}
                                    className="btn btn-error btn-xs btn-square"
                                    title="End Session"
                                >
                                    <PhoneOffIcon className="size-3" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 relative overflow-hidden bg-black">
                            <div className="h-full scale-[0.6] origin-top transform">
                                <VideoCallUI isMini={true} chatClient={chatClient} channel={channel} />
                            </div>

                            <div className="absolute inset-0 bg-transparent cursor-move" />
                        </div>
                    </div>
                </Draggable>
            </StreamCall>
        </StreamVideo>
    );
};

export default FloatingVideoCall;
