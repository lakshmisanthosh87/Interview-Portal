import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router";
import { PROBLEMS } from "../data/Problems";
import Navbar from "../components/Navbar";
import { Clock, Timer, AlertTriangle } from "lucide-react";

import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import ProblemDescription from "../components/ProblemDescription";
import OutputPanel from "../components/OutputPanel";
import CodeEditor from "../components/CodeEditor";
import { executeCode } from "../lib/piston";

import toast from "react-hot-toast";
import confetti from "canvas-confetti";
import AIAnalysisModal from "../components/AIAnalysisModal";
import HintModal from '../components/HintModal';
import axios from "axios";

function ProblemPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Map editor language keys to the keys used inside `problem.code_snippets`
  const SNIPPET_LANG_KEY = {
    javascript: "javascript",
    typescript: "typescript",
    python: "python3",
    java: "java",
    cpp: "cpp",
    c: "c",
    csharp: "csharp",
    go: "golang",
    rust: "rust",
    php: "php",
    ruby: "ruby",
    kotlin: "kotlin",
    swift: "swift",
  };

  // Helper function to find problem by ID/slug
  const findProblemById = (problemId) => {
    if (!problemId) return null;
    return PROBLEMS.find(
      (p) =>
        p.frontend_id === problemId ||
        p.problem_id === problemId ||
        p.problem_slug === problemId
    );
  };

  const getSnippetForProblem = (problem, lang) => {
    if (!problem?.code_snippets) return "";
    const key = SNIPPET_LANG_KEY[lang] || lang;
    return problem.code_snippets[key] || "";
  };

  // Get initial problem ID from URL or default to "two-sum"/first problem
  const getInitialProblemId = () => {
    if (id) {
      const problem = findProblemById(id);
      if (problem) {
        return (
          problem.frontend_id || problem.problem_id || problem.problem_slug
        );
      }
    }
    const defaultProblem =
      PROBLEMS.find((p) => p.problem_slug === "two-sum") || PROBLEMS[0];
    return (
      defaultProblem?.frontend_id ||
      defaultProblem?.problem_id ||
      defaultProblem?.problem_slug ||
      ""
    );
  };

  const [currentProblemId, setCurrentProblemId] = useState(() =>
    getInitialProblemId()
  );
  const [selectedLanguage, setSelectedLanguage] = useState("javascript");
  const [code, setCode] = useState("");
  const [output, setOutput] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFetchingHint, setIsFetchingHint] = useState(false);
  const [hint, setHint] = useState("");
  const [isHintModalOpen, setIsHintModalOpen] = useState(false);

  // Timer State
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerDuration, setTimerDuration] = useState(30); // minutes
  const [timeLeft, setTimeLeft] = useState(30 * 60); // seconds
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);

  const timerRef = useRef(null);

  const currentProblem = findProblemById(currentProblemId);

  // Timer Logic
  useEffect(() => {
    if (isTimerRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setIsTimerRunning(false);
            setIsReadOnly(true);
            toast.error("Time is Up! Editor is locked.");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }

    return () => clearInterval(timerRef.current);
  }, [isTimerRunning]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleTimerToggle = () => {
    const newEnabled = !timerEnabled;
    setTimerEnabled(newEnabled);
    if (newEnabled) {
      setIsTimerRunning(true);
      setIsReadOnly(false);
      setTimeLeft(timerDuration * 60);
    } else {
      setIsTimerRunning(false);
      setIsReadOnly(false);
      setTimeLeft(timerDuration * 60);
    }
  };

  const handleDurationChange = (e) => {
    const minutes = parseInt(e.target.value);
    setTimerDuration(minutes);
    if (!isTimerRunning) {
      setTimeLeft(minutes * 60);
    } else {
      // If running, do we reset? The requirements say "Start countdown immediately" on enable.
      // If user changes duration while running, let's reset to new duration for simplicity and correctness.
      setTimeLeft(minutes * 60);
    }
  };

  // update problem when URL param or selected language changes
  useEffect(() => {
    const problemFromRoute = id ? findProblemById(id) : currentProblem;
    if (problemFromRoute) {
      const newId =
        problemFromRoute.frontend_id ||
        problemFromRoute.problem_id ||
        problemFromRoute.problem_slug;
      if (newId !== currentProblemId) {
        setCurrentProblemId(newId);
      }
      setCode(getSnippetForProblem(problemFromRoute, selectedLanguage));
      setOutput(null);
    }
  }, [id, selectedLanguage]);

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setSelectedLanguage(newLang);
    setCode(getSnippetForProblem(currentProblem, newLang));
    setOutput(null);
  };

  const handleProblemChange = (newProblemId) =>
    navigate(`/problem/${newProblemId}`);

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

  const handleRunCode = async () => {
    setIsRunning(true);
    setOutput(null);

    const result = await executeCode(selectedLanguage, code);
    setOutput(result);
    setIsRunning(false);

    if (result.success) {
      triggerConfetti();
      toast.success("Code executed successfully!");
    } else {
      toast.error("Code execution failed!");
    }
  };

  const handleAnalyze = async () => {
    if (!code) {
      toast.error("Please write some code first!");
      return;
    }
    setIsAnalyzing(true);
    try {
      const res = await axios.post("http://localhost:5000/api/ai/analyze", {
        code,
        language: selectedLanguage,
        problemDescription: currentProblem?.description || currentProblem?.problem_slug // fallback if description missing
      }, { withCredentials: true }); // Ensure cookies for auth are sent if needed, though this route might not be auth protected strictly yet or assumes cookie auth

      setAnalysisResult(res.data);
      setIsModalOpen(true);
    } catch (error) {
      console.error("Analysis failed:", error);
      toast.error(error.response?.data?.error || "Failed to analyze code");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGetHint = async () => {
    if (!code) {
      toast.error("Please write some code first!");
      return;
    }
    setIsFetchingHint(true);
    try {
      const res = await axios.post(
        "http://localhost:5000/api/ai/hint",
        {
          code,
          language: selectedLanguage,
          problemDescription: currentProblem?.description || currentProblem?.problem_slug,
        },
        { withCredentials: true }
      );

      if (res.data.hint) {
        setHint(res.data.hint);
        setIsHintModalOpen(true);
      }
    } catch (error) {
      console.error("Hint fetch failed:", error);
      toast.error("Failed to get hint");
    } finally {
      setIsFetchingHint(false);
    }
  };

  return (
    <div className="h-screen bg-base-100 flex flex-col">
      <Navbar />

      {/* Main split area: prevent page scroll, let panels handle their own scrolling */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Timer Control Bar */}
        <div className="bg-base-100 border-b border-base-300 px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <label className="label cursor-pointer gap-2">
              <span className="label-text font-medium flex items-center gap-2">
                <Timer className="size-4" />
                Enable Timer
              </span>
              <input
                type="checkbox"
                className="checkbox checkbox-primary checkbox-sm"
                checked={timerEnabled}
                onChange={handleTimerToggle}
              />
            </label>

            {timerEnabled && (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-4 duration-300">
                <select
                  className="select select-bordered select-sm"
                  value={timerDuration}
                  onChange={handleDurationChange}
                  disabled={timeLeft === 0 && isReadOnly} // Disable changing duration when time is up? or allow reset? Allow reset by toggling off/on usually.
                >
                  <option value={15}>15 Minutes</option>
                  <option value={30}>30 Minutes</option>
                  <option value={45}>45 Minutes</option>
                  <option value={60}>60 Minutes</option>
                </select>

                <div className={`font-mono text-xl font-bold ml-4 ${timeLeft < 120 ? "text-error animate-pulse" : "text-primary"
                  }`}>
                  {formatTime(timeLeft)}
                </div>

                {timeLeft < 300 && timeLeft > 0 && (
                  <div className="text-warning text-xs flex items-center gap-1">
                    <AlertTriangle className="size-3" />
                    Less than 5m left!
                  </div>
                )}

                {timeLeft === 0 && (
                  <div className="text-error text-sm font-bold">
                    Time's Up!
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

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
                  onAnalyze={handleAnalyze}
                  isAnalyzing={isAnalyzing}
                  onGetHint={handleGetHint}
                  isFetchingHint={isFetchingHint}
                  readOnly={isReadOnly}
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
      <AIAnalysisModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        analysis={analysisResult}
      />
      <HintModal
        isOpen={isHintModalOpen}
        onClose={() => setIsHintModalOpen(false)}
        hint={hint}
      />
    </div>
  );
}

export default ProblemPage;