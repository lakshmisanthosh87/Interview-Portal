import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { PROBLEMS } from "../data/Problems";
import Navbar from "../components/Navbar";

import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import ProblemDescription from "../components/ProblemDescription";
import OutputPanel from "../components/OutputPanel";
import CodeEditor from "../components/CodeEditor";
import { executeCode } from "../lib/piston";

import toast from "react-hot-toast";
import confetti from "canvas-confetti";

function ProblemPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Helper function to find problem by ID
  const findProblemById = (problemId) => {
    if (!problemId) return null;
    return PROBLEMS.find(
      (p) =>
        p.frontend_id === problemId ||
        p.problem_id === problemId ||
        p.problem_slug === problemId
    );
  };

  // Get initial problem ID from URL or default
  const getInitialProblemId = () => {
    if (id) {
      const problem = findProblemById(id);
      if (problem) {
        return problem.frontend_id || problem.problem_id || problem.problem_slug;
      }
    }
    // Default to first problem or "two-sum" if exists
    const defaultProblem = PROBLEMS.find(
      (p) => p.frontend_id === "two-sum" || p.problem_id === "two-sum"
    ) || PROBLEMS[0];
    return defaultProblem?.frontend_id || defaultProblem?.problem_id || defaultProblem?.problem_slug || "";
  };

  const [currentProblemId, setCurrentProblemId] = useState(() => getInitialProblemId());
  const [selectedLanguage, setSelectedLanguage] = useState("javascript");
  const [code, setCode] = useState("");
  const [output, setOutput] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  const currentProblem = findProblemById(currentProblemId);

  // update problem when URL param changes
  useEffect(() => {
    if (id) {
      const problem = findProblemById(id);
      if (problem) {
        const problemId = problem.frontend_id || problem.problem_id || problem.problem_slug;
        setCurrentProblemId(problemId);
        if (problem.starterCode && problem.starterCode[selectedLanguage]) {
          setCode(problem.starterCode[selectedLanguage]);
        } else {
          setCode("");
        }
        setOutput(null);
      }
    } else {
      // If no id in URL, use default
      const defaultProblemId = getInitialProblemId();
      if (defaultProblemId && defaultProblemId !== currentProblemId) {
        setCurrentProblemId(defaultProblemId);
        const problem = findProblemById(defaultProblemId);
        if (problem?.starterCode?.[selectedLanguage]) {
          setCode(problem.starterCode[selectedLanguage]);
        } else {
          setCode("");
        }
      }
    }
  }, [id, selectedLanguage]);

  // Initialize code when currentProblem changes (only if code is empty)
  useEffect(() => {
    if (currentProblem?.starterCode?.[selectedLanguage]) {
      const starterCode = currentProblem.starterCode[selectedLanguage];
      // Only set if code is empty or doesn't match the starter code
      if (!code || code.trim() === "") {
        setCode(starterCode);
      }
    }
  }, [currentProblem?.frontend_id || currentProblem?.problem_id, selectedLanguage]);

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setSelectedLanguage(newLang);
    if (currentProblem?.starterCode?.[newLang]) {
      setCode(currentProblem.starterCode[newLang]);
    }
    setOutput(null);
  };

  const handleProblemChange = (newProblemId) => navigate(`/problem/${newProblemId}`);

  const triggerConfetti = () => {
    confetti({
      particleCount: 80,
      spread: 250,
      origin: { x: 0.2, y: 0.6 },
    });

    confetti({
      particleCount: 80,
      spread: 250,
      origin: { x: 0.8, y: 0.6 },
    });
  };

  const normalizeOutput = (output) => {
    if (output == null || output === undefined) return "";
    const str = String(output);
    // Remove leading/trailing whitespace, normalize line endings, and collapse multiple spaces
    return str
      .trim()
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\n+/g, "\n")
      .replace(/[ \t]+/g, " ");
  };

  const checkIfTestsPassed = (actualOutput, expectedOutput) => {
    if (actualOutput == null || expectedOutput == null) return false;
    const normalizedActual = normalizeOutput(actualOutput);
    const normalizedExpected = normalizeOutput(expectedOutput);

    return normalizedActual === normalizedExpected;
  };

  const handleRunCode = async () => {
    setIsRunning(true);
    setOutput(null);

    const result = await executeCode(selectedLanguage, code);
    setOutput(result);
    setIsRunning(false);

    // check if code executed successfully and matches expected output

    if (result.success) {
      const expectedOutput = currentProblem?.expectedOutput?.[selectedLanguage];
      const testsPassed = expectedOutput
        ? checkIfTestsPassed(result.output, expectedOutput)
        : false;

      if (testsPassed) {
        triggerConfetti();
        toast.success("All tests passed! Great job!");
      } else {
        toast.error("Tests failed. Check your output!");
      }
    } else {
      toast.error("Code execution failed!");
    }
  };

  return (
    <div className="h-screen bg-base-100 flex flex-col">
      <Navbar />

      {/* Main split area: prevent page scroll, let panels handle their own scrolling */}
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal">
          {/* left panel- problem desc */}
          <Panel defaultSize={40} minSize={30}>
            {/* Make left panel (problem description) independently scrollable */}
            <div className="h-full overflow-y-auto">
              <ProblemDescription
                problem={currentProblem}
                currentProblemId={currentProblemId}
                onProblemChange={handleProblemChange}
                allProblems={PROBLEMS}
              />
            </div>
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