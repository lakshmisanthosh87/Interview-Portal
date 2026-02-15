import { Code2Icon, LoaderIcon, PlusIcon, FileTextIcon } from "lucide-react";
import { PROBLEMS } from "../data/Problems";
import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";

function CreateSessionModal({
  isOpen,
  onClose,
  roomConfig,
  setRoomConfig,
  onCreateRoom,
  isCreating,
}) {
  const problems = PROBLEMS || [];
  const [isCustomProblem, setIsCustomProblem] = useState(false);
  const [customProblem, setCustomProblem] = useState({
    title: "",
    description: "",
    difficulty: "easy",
  });

  if (!isOpen) return null;

  const handleCreateSession = async () => {
    if (isCustomProblem) {
      if (!customProblem.title || !customProblem.description) {
        toast.error("Please fill in all required fields");
        return;
      }

      try {
        // Create custom problem first
        const res = await axios.post("http://localhost:5000/api/problems", customProblem, {
          withCredentials: true,
        });

        const newProblem = res.data;

        // callback to create room with custom problem ID
        onCreateRoom({
          problem: newProblem.title,
          difficulty: newProblem.difficulty,
          customProblemId: newProblem._id
        });

      } catch (error) {
        console.error("Failed to create custom problem:", error);
        toast.error("Failed to create custom problem");
      }
    } else {
      // Existing flow
      onCreateRoom();
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-2xl mb-6">Create New Session</h3>

        <div className="space-y-6">

          {/* TOGGLE */}
          <div className="flex bg-base-200 p-1 rounded-lg">
            <button
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${!isCustomProblem ? 'bg-white shadow' : 'text-base-content/70 hover:bg-base-300'}`}
              onClick={() => setIsCustomProblem(false)}
            >
              Choose Existing
            </button>
            <button
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${isCustomProblem ? 'bg-white shadow' : 'text-base-content/70 hover:bg-base-300'}`}
              onClick={() => setIsCustomProblem(true)}
            >
              Create Custom
            </button>
          </div>

          {!isCustomProblem ? (
            /* EXISTING PROBLEM SELECTOR */
            <div className="space-y-2">
              <label className="label">
                <span className="label-text font-semibold">Select Problem</span>
                <span className="label-text-alt text-error">*</span>
              </label>

              <select
                className="select select-bordered w-full"
                value={roomConfig.problem}
                onChange={(e) => {
                  const selectedProblem = problems.find((p) => p.title === e.target.value);
                  if (selectedProblem) {
                    setRoomConfig({
                      ...roomConfig,
                      difficulty: selectedProblem.difficulty || "",
                      problem: e.target.value,
                      customProblemId: null // reset
                    });
                  }
                }}
              >
                <option value="" disabled>
                  Choose a coding problem...
                </option>

                {problems.map((problem, index) => {
                  const problemId = problem.frontend_id || problem.problem_id || problem.problem_slug || index;
                  return (
                    <option key={problemId} value={problem.title}>
                      {problem.title} ({problem.difficulty || "Unknown"})
                    </option>
                  );
                })}
              </select>
            </div>
          ) : (
            /* CUSTOM PROBLEM FORM */
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Problem Title</span>
                  <span className="label-text-alt text-error">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Reverse a Linked List"
                  className="input input-bordered w-full"
                  value={customProblem.title}
                  onChange={(e) => setCustomProblem({ ...customProblem, title: e.target.value })}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Difficulty</span>
                </label>
                <select
                  className="select select-bordered w-full"
                  value={customProblem.difficulty}
                  onChange={(e) => setCustomProblem({ ...customProblem, difficulty: e.target.value })}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Description</span>
                  <span className="label-text-alt text-error">*</span>
                </label>
                <textarea
                  className="textarea textarea-bordered h-32"
                  placeholder="Describe the problem, input/output, etc."
                  value={customProblem.description}
                  onChange={(e) => setCustomProblem({ ...customProblem, description: e.target.value })}
                ></textarea>
              </div>
            </div>
          )}

          {/* ROOM SUMMARY */}
          {!isCustomProblem && roomConfig.problem && (
            <div className="alert alert-success">
              <Code2Icon className="size-5" />
              <div>
                <p className="font-semibold">Room Summary:</p>
                <p>
                  Problem: <span className="font-medium">{roomConfig.problem}</span>
                </p>
                <p>
                  Max Participants: <span className="font-medium">2 (1-on-1 session)</span>
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>

          <button
            className="btn btn-primary gap-2"
            onClick={handleCreateSession}
            disabled={isCreating || (!isCustomProblem && !roomConfig.problem)}
          >
            {isCreating ? (
              <LoaderIcon className="size-5 animate-spin" />
            ) : (
              <PlusIcon className="size-5" />
            )}

            {isCreating ? "Creating..." : "Create Session"}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
}
export default CreateSessionModal;