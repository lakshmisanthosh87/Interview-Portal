import { Loader2Icon } from "lucide-react";

function OutputPanel({ output, isRunning }) {
  return (
    <div className="h-full bg-base-100 flex flex-col">
      <div className="px-4 py-2 bg-base-200 border-b border-base-300 font-semibold text-sm">
        <div className="flex items-center justify-between">
          <span>Output</span>
          {isRunning && (
            <span className="inline-flex items-center gap-2 text-xs text-base-content/60">
              <Loader2Icon className="size-4 animate-spin" />
              Running...
            </span>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {output === null && !isRunning ? (
          <p className="text-base-content/50 text-sm">Click "Run Code" to see the output here...</p>
        ) : output?.success ? (
          <pre className="text-sm font-mono text-success whitespace-pre-wrap">{output.output}</pre>
        ) : output && !output.success ? (
          <div>
            {output.output && (
              <pre className="text-sm font-mono text-base-content whitespace-pre-wrap mb-2">
                {output.output}
              </pre>
            )}
            <pre className="text-sm font-mono text-error whitespace-pre-wrap">{output.error}</pre>
          </div>
        ) : (
          <p className="text-base-content/50 text-sm">Running...</p>
        )}
      </div>
    </div>
  );
}
export default OutputPanel;