import { X, Lightbulb } from "lucide-react";

const HintModal = ({ isOpen, onClose, hint }) => {
    if (!isOpen || !hint) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-base-100 rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col border border-base-300 animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-base-300">
                    <h2 className="text-2xl font-bold flex items-center gap-2 text-warning">
                        <Lightbulb className="w-6 h-6 fill-current" />
                        Interviewer's Hint
                    </h2>
                    <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="prose prose-invert max-w-none">
                        <div className="bg-base-200 p-4 rounded-lg border border-base-300 shadow-inner">
                            <pre className="whitespace-pre-wrap font-sans text-base leading-relaxed text-base-content/90">
                                {hint}
                            </pre>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-base-300 flex justify-between items-center bg-base-200/50 rounded-b-xl">
                    <span className="text-xs text-base-content/50 ml-2">Tip: Try to solve it yourself first!</span>
                    <button className="btn btn-primary" onClick={onClose}>Got it!</button>
                </div>

            </div>
        </div>
    );
};

export default HintModal;
