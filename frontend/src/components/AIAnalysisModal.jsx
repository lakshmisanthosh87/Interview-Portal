import { X, CheckCircle, AlertTriangle, AlertCircle, Clock, Database, Code, BookOpen } from "lucide-react";

const AIAnalysisModal = ({ isOpen, onClose, analysis }) => {
    if (!isOpen || !analysis) return null;

    const getScoreColor = (score) => {
        if (score >= 8) return "text-success";
        if (score >= 5) return "text-warning";
        return "text-error";
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-base-100 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-base-300">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-base-300">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        ✨ AI Code Analysis
                    </h2>
                    <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="stat bg-base-200 rounded-lg p-4">
                            <div className="stat-figure text-primary">
                                <Clock className="w-8 h-8 opacity-50" />
                            </div>
                            <div className="stat-title">Time Complexity</div>
                            <div className="stat-value text-lg font-mono">{analysis.timeComplexity}</div>
                        </div>

                        <div className="stat bg-base-200 rounded-lg p-4">
                            <div className="stat-figure text-secondary">
                                <Database className="w-8 h-8 opacity-50" />
                            </div>
                            <div className="stat-title">Space Complexity</div>
                            <div className="stat-value text-lg font-mono">{analysis.spaceComplexity}</div>
                        </div>

                        <div className="stat bg-base-200 rounded-lg p-4">
                            <div className="stat-figure text-accent">
                                <Code className="w-8 h-8 opacity-50" />
                            </div>
                            <div className="stat-title">Code Quality</div>
                            <div className={`stat-value text-lg ${getScoreColor(analysis.codeQualityScore)}`}>
                                {analysis.codeQualityScore}/10
                            </div>
                        </div>

                        <div className="stat bg-base-200 rounded-lg p-4">
                            <div className="stat-figure text-info">
                                <BookOpen className="w-8 h-8 opacity-50" />
                            </div>
                            <div className="stat-title">Readability</div>
                            <div className={`stat-value text-lg ${getScoreColor(analysis.readabilityScore)}`}>
                                {analysis.readabilityScore}/10
                            </div>
                        </div>
                    </div>

                    {/* Analysis Sections */}
                    <div className="space-y-6">

                        {/* Correctness */}
                        <div className="card bg-base-200 shadow-sm">
                            <div className="card-body">
                                <h3 className="card-title text-success flex items-center gap-2">
                                    <CheckCircle className="w-5 h-5" /> Correctness Analysis
                                </h3>
                                <p>{analysis.correctnessAnalysis}</p>
                            </div>
                        </div>

                        {/* Optimization Suggestions */}
                        {analysis.optimizationSuggestions && analysis.optimizationSuggestions.length > 0 && (
                            <div className="card bg-base-200 shadow-sm">
                                <div className="card-body">
                                    <h3 className="card-title text-info flex items-center gap-2">
                                        <AlertCircle className="w-5 h-5" /> Optimization Suggestions
                                    </h3>
                                    <ul className="list-disc list-inside space-y-1">
                                        {analysis.optimizationSuggestions.map((suggestion, idx) => (
                                            <li key={idx}>{suggestion}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}

                        {/* Best Practices */}
                        {analysis.bestPracticesIssues && analysis.bestPracticesIssues.length > 0 && (
                            <div className="card bg-base-200 shadow-sm">
                                <div className="card-body">
                                    <h3 className="card-title text-warning flex items-center gap-2">
                                        <AlertTriangle className="w-5 h-5" /> Best Practices & Issues
                                    </h3>
                                    <ul className="list-disc list-inside space-y-1">
                                        {analysis.bestPracticesIssues.map((issue, idx) => (
                                            <li key={idx}>{issue}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}

                        {/* Improved Approach */}
                        {analysis.improvedApproachExplanation && (
                            <div className="card bg-base-200 shadow-sm">
                                <div className="card-body">
                                    <h3 className="card-title text-primary flex items-center gap-2">
                                        <Code className="w-5 h-5" /> Improved Approach
                                    </h3>
                                    <p>{analysis.improvedApproachExplanation}</p>
                                </div>
                            </div>
                        )}

                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-base-300 flex justify-end">
                    <button className="btn" onClick={onClose}>Close</button>
                </div>

            </div>
        </div>
    );
};

export default AIAnalysisModal;
