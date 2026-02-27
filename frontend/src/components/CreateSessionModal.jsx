import { Code2Icon, LoaderIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { PROBLEMS } from "../data/Problems";
import { useState } from "react";
import axiosInstance from "../lib/axios";
import toast from "react-hot-toast";

function CreateSessionModal({
  isOpen,
  onClose,
  onCreateRoom,
  isCreating,
}) {
  const allExistingProblems = PROBLEMS || [];
  const [selectedProblems, setSelectedProblems] = useState([]); // Array of strings (titles)
  const [selectedCustomProblems, setSelectedCustomProblems] = useState([]); // Array of objects
  const [difficulty, setDifficulty] = useState("easy");
  
  const [isCustomProblem, setIsCustomProblem] = useState(false);
  const [customProblem, setCustomProblem] = useState({
    title: "",
    description: "",
    difficulty: "easy",
  });

  if (!isOpen) return null;

  const handleAddExisting = (e) => {
    const title = e.target.value;
    if (!title) return;
    if (selectedProblems.includes(title)) {
      toast.error("Problem already added");
      return;
    }
    setSelectedProblems([...selectedProblems, title]);
    
    // Auto-update difficulty based on the first problem if not set or just for convenience
    if (selectedProblems.length === 0 && selectedCustomProblems.length === 0) {
        const prob = allExistingProblems.find(p => p.title === title);
        if (prob) setDifficulty(prob.difficulty.toLowerCase());
    }
  };

  const handleAddCustom = () => {
    if (!customProblem.title || !customProblem.description) {
      toast.error("Please fill in title and description");
      return;
    }
    setSelectedCustomProblems([...selectedCustomProblems, { ...customProblem }]);
    setCustomProblem({ title: "", description: "", difficulty: "easy" });
  };

  const removeExisting = (title) => {
    setSelectedProblems(selectedProblems.filter(p => p !== title));
  };

  const removeCustom = (index) => {
    setSelectedCustomProblems(selectedCustomProblems.filter((_, i) => i !== index));
  };

  const handleCreateSession = async () => {
    if (selectedProblems.length === 0 && selectedCustomProblems.length === 0) {
      toast.error("Please add at least one problem");
      return;
    }

    try {
      // Create all custom problems first
      const customProblemIds = [];
      for (const cp of selectedCustomProblems) {
        const res = await axiosInstance.post("problems", cp);
        customProblemIds.push(res.data._id);
      }

      // Call parent to create room
      onCreateRoom({
        problems: selectedProblems,
        difficulty: difficulty.toLowerCase(),
        customProblems: customProblemIds,
      });

    } catch (error) {
      console.error("Failed to create session:", error);
      toast.error("Failed to create custom problems");
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl bg-base-100 shadow-2xl border border-base-300">
        <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-2xl">Create Session</h3>
            <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}><XIcon className="size-5"/></button>
        </div>

        <div className="space-y-6">
          {/* SELECTED PROBLEMS LIST */}
          {(selectedProblems.length > 0 || selectedCustomProblems.length > 0) && (
            <div className="bg-base-200 p-4 rounded-xl border border-base-300">
              <label className="text-xs font-bold uppercase text-base-content/50 mb-3 block">Selected Problems</label>
              <div className="flex flex-wrap gap-2">
                {selectedProblems.map(p => (
                  <div key={p} className="badge badge-primary gap-2 p-3 h-auto">
                    <span>{p}</span>
                    <button onClick={() => removeExisting(p)}><Trash2Icon className="size-3 hover:text-error transition-colors"/></button>
                  </div>
                ))}
                {selectedCustomProblems.map((p, i) => (
                  <div key={i} className="badge badge-secondary gap-2 p-3 h-auto">
                    <span>{p.title} (Custom)</span>
                    <button onClick={() => removeCustom(i)}><Trash2Icon className="size-3 hover:text-error transition-colors"/></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Session Difficulty</span></label>
            <select className="select select-bordered w-full" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
            </select>
          </div>

          <div className="divider">Add Problems</div>

          {/* TOGGLE */}
          <div className="flex bg-base-200 p-1 rounded-lg">
            <button
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${!isCustomProblem ? 'bg-white shadow' : 'text-base-content/70 hover:bg-base-300'}`}
              onClick={() => setIsCustomProblem(false)}
            >
              Existing Problem
            </button>
            <button
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${isCustomProblem ? 'bg-white shadow' : 'text-base-content/70 hover:bg-base-300'}`}
              onClick={() => setIsCustomProblem(true)}
            >
              Custom Problem
            </button>
          </div>

          {!isCustomProblem ? (
            <div className="space-y-2">
              <select className="select select-bordered w-full" value="" onChange={handleAddExisting}>
                <option value="" disabled>Choose an existing problem to add...</option>
                {allExistingProblems.map((p, idx) => (
                  <option key={idx} value={p.title}>{p.title} ({p.difficulty})</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-4 p-4 bg-base-200 rounded-xl border border-base-300 animate-in fade-in slide-in-from-top-2">
              <input
                type="text"
                placeholder="Problem Title"
                className="input input-bordered w-full input-sm"
                value={customProblem.title}
                onChange={(e) => setCustomProblem({ ...customProblem, title: e.target.value })}
              />
              <select
                className="select select-bordered w-full select-sm"
                value={customProblem.difficulty}
                onChange={(e) => setCustomProblem({ ...customProblem, difficulty: e.target.value })}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
              <textarea
                className="textarea textarea-bordered w-full textarea-sm h-24"
                placeholder="Description, notes, etc."
                value={customProblem.description}
                onChange={(e) => setCustomProblem({ ...customProblem, description: e.target.value })}
              ></textarea>
              <button className="btn btn-sm btn-outline btn-block gap-2" onClick={handleAddCustom}>
                <PlusIcon className="size-4"/> Add Custom Problem
              </button>
            </div>
          )}
        </div>

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose} disabled={isCreating}>Cancel</button>
          <button
            className="btn btn-primary px-8 gap-2"
            onClick={handleCreateSession}
            disabled={isCreating || (selectedProblems.length === 0 && selectedCustomProblems.length === 0)}
          >
            {isCreating ? <LoaderIcon className="size-5 animate-spin"/> : <PlusIcon className="size-5"/>}
            {isCreating ? "Creating..." : "Create Session"}
          </button>
        </div>
      </div>
      <div className="modal-backdrop bg-black/50" onClick={onClose}></div>
    </div>
  );
}
export default CreateSessionModal;