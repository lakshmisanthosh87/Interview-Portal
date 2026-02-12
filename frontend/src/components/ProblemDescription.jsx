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

  const topics = Array.isArray(problem.topics) ? problem.topics : [];
  const hints = Array.isArray(problem.hints) ? problem.hints : [];

  // Find similar problems that share at least one topic
  const similarProblems =
    Array.isArray(allProblems) && topics.length > 0
      ? allProblems
          .filter((p) => {
            if (!p || p === problem) return false;
            if (!Array.isArray(p.topics)) return false;
            if (
              (p.frontend_id && p.frontend_id === problem.frontend_id) ||
              (p.problem_id && p.problem_id === problem.problem_id) ||
              (p.problem_slug && p.problem_slug === problem.problem_slug)
            ) {
              return false;
            }
            return p.topics.some((t) => topics.includes(t));
          })
          .slice(0, 5)
      : [];

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

        {/* Topics (tags) */}
        {topics.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {topics.map((topic) => (
              <span
                key={topic}
                className="badge badge-outline badge-sm px-3 py-1 text-xs"
              >
                {topic}
              </span>
            ))}
          </div>
        )}

        {/* Hints section similar to LeetCode */}
        {hints.length > 0 && (
          <details className="mt-3 bg-base-200 rounded-lg p-3 border border-base-300">
            <summary className="cursor-pointer text-sm font-semibold text-primary">
              Hints
            </summary>
            <ul className="mt-2 space-y-2 text-sm text-base-content/80 list-disc list-inside">
              {hints.map((hint, idx) => (
                <li
                  key={idx}
                  // Hints may contain inline HTML like <code>, so we render it as HTML
                  dangerouslySetInnerHTML={{ __html: hint }}
                />
              ))}
            </ul>
          </details>
        )}

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

        {/* SIMILAR PROBLEMS */}
        {similarProblems.length > 0 && (
          <div className="bg-base-100 rounded-xl shadow-sm p-5 border border-base-300">
            <h2 className="text-xl font-bold mb-4 text-base-content">Similar Problems</h2>
            <ul className="space-y-2 text-sm">
              {similarProblems.map((p) => {
                const id =
                  p.problem_slug || p.frontend_id || p.problem_id || p.title;
                return (
                  <li
                    key={id}
                    className="flex items-center justify-between gap-3"
                  >
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs px-0 justify-start flex-1 text-left normal-case"
                      onClick={() =>
                        onProblemChange(
                          p.problem_slug || p.frontend_id || p.problem_id
                        )
                      }
                    >
                      <span className="truncate">{p.title}</span>
                    </button>
                    <span
                      className={`badge badge-outline ${getDifficultyBadgeClass(
                        p.difficulty
                      )}`}
                    >
                      {p.difficulty}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProblemDescription;