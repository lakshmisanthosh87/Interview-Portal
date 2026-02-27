import { useState } from "react";
import { SearchIcon, Loader2Icon, CalendarIcon, UserIcon, PlayIcon } from "lucide-react";
import { useNavigate } from "react-router";
import { sessionApi } from "../api/session";
import toast from "react-hot-toast";

const DashboardSearch = () => {
    const [searchInput, setSearchInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [sessionResults, setSessionResults] = useState(null);
    const navigate = useNavigate();

    const extractSessionId = (input) => {
        // If it's a full URL, extract the last part
        if (input.includes("/session/")) {
            return input.split("/session/")[1].split("?")[0];
        }
        return input.trim();
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchInput.trim()) return;

        setIsLoading(true);
        setSessionResults(null);

        const sessionId = extractSessionId(searchInput);

        try {
            const { session } = await sessionApi.getSessionById(sessionId);
            setSessionResults(session);
        } catch (error) {
            toast.error(error.response?.data?.message || "Session not found");
            setSessionResults(null);
        } finally {
            setIsLoading(false);
        }
    };

    const handleJoin = () => {
        if (sessionResults) {
            navigate(`/session/${sessionResults._id}`);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto mb-10">
            <form onSubmit={handleSearch} className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-base-content/40 group-focus-within:text-primary transition-colors">
                    <SearchIcon className="w-5 h-5" />
                </div>
                <input
                    type="text"
                    placeholder="Paste session link or session ID to join..."
                    className="input input-bordered w-full pl-12 h-14 bg-base-100 shadow-sm focus:shadow-md transition-all border-base-content/10 focus:border-primary text-lg"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                />
                <button
                    type="submit"
                    disabled={isLoading || !searchInput.trim()}
                    className="absolute right-2 top-2 btn btn-primary h-10 min-h-0 px-6"
                >
                    {isLoading ? <Loader2Icon className="w-4 h-4 animate-spin" /> : "Search"}
                </button>
            </form>

            {sessionResults && (
                <div className="mt-6 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="card bg-base-100 shadow-lg border border-base-content/5 overflow-hidden">
                        <div className="p-1 bg-gradient-to-r from-primary/20 to-secondary/20" />
                        <div className="card-body p-6 flex-row items-center justify-between gap-6">
                            <div className="flex-1 space-y-3">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-xl font-bold text-base-content">
                                        {sessionResults.problem}
                                    </h3>
                                    <span className={`badge badge-sm ${sessionResults.status === "active" ? "badge-success" : "badge-ghost"
                                        }`}>
                                        {sessionResults.status}
                                    </span>
                                </div>

                                <div className="flex flex-wrap gap-4 text-sm text-base-content/60">
                                    <div className="flex items-center gap-1.5">
                                        <UserIcon className="w-4 h-4 text-primary" />
                                        <span className="font-medium text-base-content/80">
                                            {sessionResults.host?.name}
                                            {sessionResults.participant && ` & ${sessionResults.participant.name}`}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <CalendarIcon className="w-4 h-4 text-secondary" />
                                        <span>
                                            Created: {new Date(sessionResults.createdAt).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col items-end gap-2">
                                <button
                                    onClick={handleJoin}
                                    disabled={sessionResults.status === "completed"}
                                    className="btn btn-primary gap-2 px-8"
                                >
                                    <PlayIcon className="w-4 h-4 fill-current" />
                                    {sessionResults.status === "completed" ? "Ended" : "Join Session"}
                                </button>
                                {sessionResults.status === "active" && (
                                    <p className="text-[10px] uppercase tracking-wider font-bold text-success/70">
                                        Live Now
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardSearch;
