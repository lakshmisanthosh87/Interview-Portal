import { PlusIcon, XIcon, LoaderIcon } from "lucide-react";
import { PROBLEMS } from "../data/Problems";
import { useState } from "react";
import { useAllProblems } from "../hooks/useSessions";
import toast from "react-hot-toast";

function AddProblemModal({ isOpen, onClose, onAddProblem, isAdding }) {
  const { data: customProblems, isLoading: isLoadingCustom } = useAllProblems();
  const [selectedType, setSelectedType] = useState("existing"); // "existing" or "custom"
  
  if (!isOpen) return null;

  const handleSelectPredefined = (e) => {
    const title = e.target.value;
    if (!title) return;
    onAddProblem({ problemTitle: title });
  };

  const handleSelectCustom = (problemId) => {
    onAddProblem({ customProblemId: problemId });
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box bg-base-100 shadow-2xl border border-base-300">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-xl">Add Problem to Session</h3>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
            <XIcon className="size-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex bg-base-200 p-1 rounded-lg mb-4">
            <button
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                selectedType === "existing" ? "bg-white shadow" : "text-base-content/70 hover:bg-base-300"
              }`}
              onClick={() => setSelectedType("existing")}
            >
              Predefined
            </button>
            <button
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                selectedType === "custom" ? "bg-white shadow" : "text-base-content/70 hover:bg-base-300"
              }`}
              onClick={() => setSelectedType("custom")}
            >
              Global Custom
            </button>
          </div>

          {selectedType === "existing" ? (
            <div className="form-control">
              <select className="select select-bordered w-full" defaultValue="" onChange={handleSelectPredefined} disabled={isAdding}>
                <option value="" disabled>Choose a problem...</option>
                {PROBLEMS.map((p, idx) => (
                  <option key={idx} value={p.title}>
                    {p.title} ({p.difficulty})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-2">
              {isLoadingCustom ? (
                <div className="flex justify-center p-4">
                  <LoaderIcon className="animate-spin text-primary" />
                </div>
              ) : customProblems?.length > 0 ? (
                customProblems.map((p) => (
                  <button
                    key={p._id}
                    onClick={() => handleSelectCustom(p._id)}
                    className="w-full text-left p-3 rounded-lg border border-base-300 hover:bg-base-200 transition-colors flex justify-between items-center"
                    disabled={isAdding}
                  >
                    <div>
                      <p className="font-medium">{p.title}</p>
                      <p className="text-xs text-base-content/50 uppercase">{p.difficulty}</p>
                    </div>
                    <PlusIcon className="size-4 text-primary" />
                  </button>
                ))
              ) : (
                <p className="text-center text-sm text-base-content/50 p-4">No custom problems found.</p>
              )}
            </div>
          )}
        </div>

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose} disabled={isAdding}>
            Cancel
          </button>
        </div>
      </div>
      <div className="modal-backdrop bg-black/50" onClick={onClose}></div>
    </div>
  );
}

export default AddProblemModal;
