import { Code2, Clock, Users, Trophy, Loader, MoreVertical, Eye, Trash2 } from "lucide-react";
import { getDifficultyBadgeClass } from "../lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useDeleteSession } from "../hooks/useSessions";
import { useUser } from "@clerk/clerk-react";
import { useState } from "react";
import toast from "react-hot-toast";


function RecentSessions({ sessions, isLoading }) {
  console.log("RecentSessions data:", sessions);
  const { user } = useUser();
  const deleteSessionMutation = useDeleteSession();
  const [selectedVideo, setSelectedVideo] = useState(null);

  const handleDelete = (e, sessionId) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this session permanently?")) {
      deleteSessionMutation.mutate(sessionId);
    }
  };

  const handleViewRecording = (e, session) => {
    e.preventDefault();
    e.stopPropagation();
    if (!session.recordingUrl) {
      toast.error("No recording available for this session");
      return;
    }
    setSelectedVideo(session);
  };

  const getFullRecordingUrl = (url) => {
    // If VITE_API_URL ends in /api, strip it to get the base server URL
    let baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
    baseUrl = baseUrl.replace(/\/api$/, "");
    return `${baseUrl}${url}`;
  };

  return (
    <div className="card bg-base-100 border-2 border-accent/20 hover:border-accent/30 mt-8">
      <div className="card-body">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gradient-to-br from-accent to-secondary rounded-xl">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-2xl font-black">Your Past Sessions</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <div className="col-span-full flex items-center justify-center py-20">
              <Loader className="w-10 h-10 animate-spin text-primary" />
            </div>
          ) : sessions.length > 0 ? (
            sessions.map((session) => {
              const isHost = session.host?.clerkId === user?.id || session.host === user?.id; // backend might return id or clerkId depending on population
              
              return (
              <div
                key={session._id}
                className={`card relative ${session.status === "active"
                  ? "bg-success/10 border-success/30 hover:border-success/60"
                  : "bg-base-200 border-base-300 hover:border-primary/30"
                  }`}
              >
                {/* 3-DOT MENU */}
                <div className="absolute top-3 right-3 z-10">
                  <div className="dropdown dropdown-end">
                    <button 
                      tabIndex={0} 
                      className="btn btn-ghost btn-xs btn-circle"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    >
                      <MoreVertical className="size-4" />
                    </button>
                    <ul tabIndex={0} className="dropdown-content z-[20] menu p-2 shadow bg-base-100 rounded-box w-52 border border-base-300">
                      <li>
                        <button 
                          onClick={(e) => handleViewRecording(e, session)}
                          className="flex items-center gap-2"
                        >
                          <Eye className="size-4" /> View Recording
                        </button>
                      </li>
                      {isHost && (
                        <li>
                          <button 
                            onClick={(e) => handleDelete(e, session._id)}
                            className="flex items-center gap-2 text-error hover:bg-error/10"
                          >
                            <Trash2 className="size-4" /> Delete Session
                          </button>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>

                {session.status === "active" && (
                  <div className="absolute top-3 right-10">
                    <div className="badge badge-success gap-1">
                      <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
                      ACTIVE
                    </div>
                  </div>
                )}

                <div className="card-body p-5 pt-10">
                  <div className="flex items-start gap-3 mb-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center ${session.status === "active"
                        ? "bg-gradient-to-br from-success to-success/70"
                        : "bg-gradient-to-br from-primary to-secondary"
                        }`}
                    >
                      <Code2 className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base mb-1 truncate">Session: "{session.title}"</h3>
                      <span
                        className={`badge badge-sm ${getDifficultyBadgeClass(session.difficulty)}`}
                      >
                        {session.difficulty}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm opacity-80 mb-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>
                        {session.createdAt && !isNaN(new Date(session.createdAt))
                          ? formatDistanceToNow(new Date(session.createdAt), {
                            addSuffix: true,
                          })
                          : "Unknown time"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>
                        {session.participant ? "2" : "1"} participant
                        {session.participant ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-base-300">
                    <span className="text-xs font-semibold opacity-80 uppercase">Completed</span>
                    <span className="text-xs opacity-40">
                      {new Date(session.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
          ) : (
            <div className="col-span-full text-center py-16">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-accent/20 to-secondary/20 rounded-3xl flex items-center justify-center">
                <Trophy className="w-10 h-10 text-accent/50" />
              </div>
              <p className="text-lg font-semibold opacity-70 mb-1">No sessions yet</p>
              <p className="text-sm opacity-50">Start your coding journey today!</p>
            </div>
          )}
        </div>
      </div>

      {/* VIDEO PLAYER MODAL */}
      {selectedVideo && (
        <div className="modal modal-open">
          <div className="modal-box max-w-4xl p-0 overflow-hidden bg-black">
            <div className="p-4 bg-base-900 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-bold text-white">Recording: {selectedVideo.title}</h3>
              <button 
                onClick={() => setSelectedVideo(null)} 
                className="btn btn-sm btn-circle btn-ghost text-white"
              >
                ✕
              </button>
            </div>
            <div className="aspect-video w-full bg-black flex items-center justify-center">
              <video 
                src={getFullRecordingUrl(selectedVideo.recordingUrl)} 
                controls 
                autoPlay 
                className="w-full h-full"
              />
            </div>
            <div className="p-4 bg-base-900 border-t border-white/10 flex justify-end">
              <button onClick={() => setSelectedVideo(null)} className="btn btn-sm">Close</button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setSelectedVideo(null)}>close</button>
          </form>
        </div>
      )}
    </div>
  );
}

export default RecentSessions;