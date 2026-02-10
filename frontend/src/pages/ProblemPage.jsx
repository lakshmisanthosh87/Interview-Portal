import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { PROBLEMS } from "../data/Problems";
import Navbar from "../components/Navbar";

import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import ProblemDescription from "../components/ProblemDescription";
import OutputPanel from "../components/OutputPanel";
import CodeEditor from "../components/CodeEditor";

const allProblems = PROBLEMS;

function findProblemByIdentifier(identifier) {
  if (!identifier) return null;
  const idStr = String(identifier);

  return (
    allProblems.find(
      (p) =>
        String(p.frontend_id) === idStr ||
        String(p.problem_id) === idStr ||
        p.problem_slug === identifier
    ) || null
  );
}

function getDefaultLanguageForProblem(problem) {
  if (!problem || !problem.code_snippets) return "javascript";
  const languages = Object.keys(problem.code_snippets);
  if (languages.includes("javascript")) return "javascript";
  if (languages.includes("python3")) return "python3";
  if (languages.length > 0) return languages[0];
  return "javascript";
}

function getProblemKey(problem) {
  if (!problem) return "";
  return problem.problem_slug || problem.frontend_id || problem.problem_id;
}

function ProblemPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const initialProblem = useMemo(() => {
    return findProblemByIdentifier(id) || allProblems[0] || null;
  }, [id]);

  const [currentProblemId, setCurrentProblemId] = useState(
    getProblemKey(initialProblem)
  );
  const [selectedLanguage, setSelectedLanguage] = useState(
    getDefaultLanguageForProblem(initialProblem)
  );
  const [code, setCode] = useState(() => {
    if (!initialProblem || !initialProblem.code_snippets) return "";
    const lang = getDefaultLanguageForProblem(initialProblem);
    return initialProblem.code_snippets[lang] || "";
  });
  const [output, setOutput] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  const currentProblem = useMemo(
    () => findProblemByIdentifier(currentProblemId),
    [currentProblemId]
  );

  // Keep state in sync when URL param changes
  useEffect(() => {
    const problemFromUrl = findProblemByIdentifier(id);
    if (!problemFromUrl) return;

    const key = getProblemKey(problemFromUrl);
    const lang = getDefaultLanguageForProblem(problemFromUrl);

    setCurrentProblemId(key);
    setSelectedLanguage(lang);
    setCode(problemFromUrl.code_snippets?.[lang] || "");
    setOutput(null);
  }, [id]);

  const handleProblemChange = (newId) => {
    const nextProblem = findProblemByIdentifier(newId);
    if (!nextProblem) return;

    const key = getProblemKey(nextProblem);
    const lang = getDefaultLanguageForProblem(nextProblem);

    setCurrentProblemId(key);
    setSelectedLanguage(lang);
    setCode(nextProblem.code_snippets?.[lang] || "");
    setOutput(null);

    navigate(`/problem/${key}`);
  };

  const handleLanguageChange = (newLanguage) => {
    if (!currentProblem || !currentProblem.code_snippets) {
      setSelectedLanguage(newLanguage);
      return;
    }

    setSelectedLanguage(newLanguage);
    const snippet = currentProblem.code_snippets[newLanguage] || "";
    setCode(snippet);
  };

  const handleRunCode = () => {
    // Wire up to piston executeCode later
    setIsRunning(true);
    // Placeholder: immediately stop "running"
    setTimeout(() => {
      setIsRunning(false);
    }, 100);
  };

  return (
    <div className="h-screen bg-base-100 flex flex-col">
      <Navbar />

      <div className="flex-1">
        <PanelGroup direction="horizontal">
          {/* left panel- problem desc */}
          <Panel defaultSize={40} minSize={30}>
            <ProblemDescription
              problem={currentProblem}
              currentProblemId={currentProblemId}
              onProblemChange={handleProblemChange}
              allProblems={allProblems}
            />
          </Panel>

          <PanelResizeHandle className="w-2 bg-base-300 hover:bg-primary transition-colors cursor-col-resize" />

          {/* right panel- code editor & output */}
          <Panel defaultSize={60} minSize={30}>
            <PanelGroup direction="vertical">
              {/* Top panel - Code editor */}
              <Panel defaultSize={70} minSize={30}>
                <CodeEditor
                  selectedLanguage={selectedLanguage}
                  code={code}
                  isRunning={isRunning}
                  onLanguageChange={handleLanguageChange}
                  onCodeChange={setCode}
                  onRunCode={handleRunCode}
                />
              </Panel>

              <PanelResizeHandle className="h-2 bg-base-300 hover:bg-primary transition-colors cursor-row-resize" />

              {/* Bottom panel - Output Panel*/}

              <Panel defaultSize={30} minSize={30}>
                <OutputPanel output={output} />
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

export default ProblemPage;