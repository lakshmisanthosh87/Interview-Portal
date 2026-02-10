// src/pages/ProblemsPage.jsx
import { useState } from "react";
import { Link } from "react-router";
import Navbar from "../components/Navbar";
import { PROBLEMS } from "../data/Problems";
import { ChevronRightIcon, Code2Icon } from "lucide-react";
import { getDifficultyBadgeClass } from "../lib/utils";

function ProblemsPage() {
  // `PROBLEMS` is already an array of problem objects
  const problems = PROBLEMS;

  // -----------------------------
  // PAGINATION LOGIC
  // -----------------------------
  const [currentPage, setCurrentPage] = useState(1);
  const problemsPerPage = 15; // change to 20 if needed

  const totalPages = Math.ceil(problems.length / problemsPerPage);
  const startIndex = (currentPage - 1) * problemsPerPage;
  const endIndex = startIndex + problemsPerPage;
  const currentProblems = problems.slice(startIndex, endIndex);

  // -----------------------------
  // STATS
  // -----------------------------
  const easyProblemsCount = problems.filter(p => p.difficulty === "Easy").length;
  const mediumProblemsCount = problems.filter(p => p.difficulty === "Medium").length;
  const hardProblemsCount = problems.filter(p => p.difficulty === "Hard").length;

  return (
    <div className="min-h-screen bg-base-200">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* HEADER */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Practice Problems</h1>
          <p className="text-base-content/70">
            Sharpen your coding skills with these curated problems
          </p>
        </div>

        {/* PROBLEMS LIST */}
        <div className="space-y-4">
          {currentProblems.map((problem, index) => (
            <Link
              key={`${problem.frontend_id || problem.problem_id || index}`}
              to={`/problem/${problem.frontend_id || problem.problem_id}`}
              className="card bg-base-100 hover:scale-[1.01] transition-transform"
            >
              <div className="card-body">
                <div className="flex items-center justify-between gap-4">
                  {/* LEFT */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Code2Icon className="size-6 text-primary" />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h2 className="text-xl font-bold">
                            {problem.title}
                          </h2>
                          <span
                            className={`badge ${getDifficultyBadgeClass(
                              problem.difficulty
                            )}`}
                          >
                            {problem.difficulty}
                          </span>
                        </div>

                        <p className="text-sm text-base-content/60">
                          {Array.isArray(problem.topics)
                            ? problem.topics.join(", ")
                            : problem.category}
                        </p>
                      </div>
                    </div>

                    <p className="text-base-content/80 mb-3">
                      {typeof problem.description === "string"
                        ? problem.description
                        : problem.description?.text}
                    </p>
                  </div>

                  {/* RIGHT */}
                  <div className="flex items-center gap-2 text-primary">
                    <span className="font-medium">Solve</span>
                    <ChevronRightIcon className="size-5" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* PAGINATION BUTTONS */}
        <div className="flex justify-center items-center gap-4 mt-10">
          <button
            className="btn btn-outline"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
          >
            Prev
          </button>

          <span className="font-medium">
            Page {currentPage} of {totalPages}
          </span>

          <button
            className="btn btn-outline"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
          >
            Next
          </button>
        </div>

        {/* STATS */}
        <div className="mt-12 card bg-base-100 shadow-lg">
          <div className="card-body">
            <div className="stats stats-vertical lg:stats-horizontal">
              <div className="stat">
                <div className="stat-title">Total Problems</div>
                <div className="stat-value text-primary">
                  {problems.length}
                </div>
              </div>

              <div className="stat">
                <div className="stat-title">Easy</div>
                <div className="stat-value text-success">
                  {easyProblemsCount}
                </div>
              </div>

              <div className="stat">
                <div className="stat-title">Medium</div>
                <div className="stat-value text-warning">
                  {mediumProblemsCount}
                </div>
              </div>

              <div className="stat">
                <div className="stat-title">Hard</div>
                <div className="stat-value text-error">
                  {hardProblemsCount}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default ProblemsPage;