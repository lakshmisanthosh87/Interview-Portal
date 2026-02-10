import { getDifficultyBadgeClass } from "../lib/utils";

function ProblemDescription({
  problem,
  currentProblemId,
  onProblemChange,
  allProblems,
}) {
  if (!problem) {
    return (
      <div className="h-full flex items-center justify-center bg-base-200">
        <span className="text-base-content/60">No problem selected</span>
      </div>
    );
  }

  const category =
    Array.isArray(problem.topics) && problem.topics.length > 0
      ? problem.topics.join(", ")
      : problem.category || "";

  const descriptionText =
    typeof problem.description === "string"
      ? problem.description
      : problem.description?.text || "";

  const descriptionParagraphs = descriptionText
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);

  // Remove lines like "Example 1:", "Example 2:", "Example 3:", "Constraints:", etc.
  const filteredDescriptionParagraphs = descriptionParagraphs.filter((para) => {
    const lower = para.toLowerCase();

    if (/^example\s*\d*:?\s*$/i.test(para)) return false;
    if (lower === "constraints:" || lower.startsWith("constraints:")) return false;
    if (lower.startsWith("example:")) return false;
    if (lower.startsWith("custom judge:")) return false;
    if (lower.startsWith("follow up:") || lower.startsWith("follow-up:")) return false;

    return true;
  });

  return (
    <div className="h-full overflow-y-auto bg-base-200">
      {/* HEADER SECTION */}
      <div className="p-6 bg-base-100 border-b border-base-300">
        <div className="flex items-start justify-between mb-3">
          <h1 className="text-3xl font-bold text-base-content">{problem.title}</h1>
          <span className={`badge ${getDifficultyBadgeClass(problem.difficulty)}`}>
            {problem.difficulty}
          </span>
        </div>
        <p className="text-base-content/60">{category}</p>

        {/* Problem selector */}
        <div className="mt-4">
          <select
            className="select select-sm w-full"
            value={currentProblemId}
            onChange={(e) => onProblemChange(e.target.value)}
          >
            {allProblems.map((p) => (
              <option
                key={p.frontend_id || p.problem_id || p.problem_slug || p.title}
                value={p.problem_slug || p.frontend_id || p.problem_id}
              >
                {p.title} - {p.difficulty}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* PROBLEM DESC */}
        <div className="bg-base-100 rounded-xl shadow-sm p-5 border border-base-300">
          <h2 className="text-xl font-bold text-base-content">Description</h2>

          <div className="space-y-3 text-base leading-relaxed">
            {filteredDescriptionParagraphs.map((para, idx) => (
              <p key={idx} className="text-base-content/90">
                {para}
              </p>
            ))}
          </div>
        </div>

        {/* EXAMPLES SECTION */}
        <div className="bg-base-100 rounded-xl shadow-sm p-5 border border-base-300">
          <h2 className="text-xl font-bold mb-4 text-base-content">Examples</h2>
          <div className="space-y-4">
            {Array.isArray(problem.examples) &&
              problem.examples.map((example, idx) => (
                <div key={idx}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="badge badge-sm">{idx + 1}</span>
                    <p className="font-semibold text-base-content">Example {idx + 1}</p>
                  </div>
                  <div className="bg-base-200 rounded-lg p-4 font-mono text-sm space-y-1.5">
                    <pre className="whitespace-pre-wrap break-words">
                      {example.example_text || ""}
                    </pre>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* CONSTRAINTS */}
        <div className="bg-base-100 rounded-xl shadow-sm p-5 border border-base-300">
          <h2 className="text-xl font-bold mb-4 text-base-content">Constraints</h2>
          <ul className="space-y-2 text-base-content/90">
            {Array.isArray(problem.constraints) &&
              problem.constraints.map((constraint, idx) => (
                <li key={idx} className="flex gap-2">
                  <span className="text-primary">•</span>
                  <code className="text-sm">{constraint}</code>
                </li>
              ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default ProblemDescription;