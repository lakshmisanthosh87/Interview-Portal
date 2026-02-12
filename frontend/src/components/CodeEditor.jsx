import Editor from "@monaco-editor/react";
import { Loader2Icon, PlayIcon } from "lucide-react";
import { LANGUAGE_CONFIG } from "../data/Problems";

// Default starter snippets per language when no starter code is provided
const DEFAULT_CODE_SNIPPETS = {
  javascript: `/**
 * @param {string} s
 * @return {string}
 */
var longestPalindrome = function(s) {

};`,
};

function CodeEditor({
  selectedLanguage,
  code,
  isRunning,
  onLanguageChange,
  onCodeChange,
  onRunCode,
}) {
  const langConfig = LANGUAGE_CONFIG[selectedLanguage] || LANGUAGE_CONFIG.javascript;
  const displayCode =
    code && code.trim() !== "" ? code : DEFAULT_CODE_SNIPPETS[selectedLanguage] || "";

  return (
    <div className="h-full bg-base-300 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-base-100 border-t border-base-300">
        <div className="flex items-center gap-3">
          <img
            src={langConfig.icon}
            alt={langConfig.name}
            className="size-6"
            onError={(e) => {
              // Fallback to a simple text if icon fails to load
              e.target.style.display = "none";
            }}
          />
          <select className="select select-sm" value={selectedLanguage} onChange={onLanguageChange}>
            {Object.entries(LANGUAGE_CONFIG).map(([key, lang]) => (
              <option key={key} value={key}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        <button className="btn btn-primary btn-sm gap-2" disabled={isRunning} onClick={onRunCode}>
          {isRunning ? (
            <>
              <Loader2Icon className="size-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <PlayIcon className="size-4" />
              Run Code
            </>
          )}
        </button>
      </div>

      <div className="flex-1">
        <Editor
          height={"100%"}
          language={langConfig.monacoLang}
          value={displayCode}
          onChange={onCodeChange}
          theme="vs-dark"
          options={{
            fontSize: 16,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            minimap: { enabled: false },
          }}
        />
      </div>
    </div>
  );
}
export default CodeEditor;