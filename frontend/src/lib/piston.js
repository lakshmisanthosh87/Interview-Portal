/**
 * NOTE: Piston API (v2) Replaced
 * The public Piston API (https://emkc.org/api/v2/piston) now requires whitelisting/authentication
 * and returns 401 Unauthorized.
 * 
 * We have switched to the Judge0 CE Public API (https://ce.judge0.com) as a temporary free alternative.
 */

// Judge0 API Configuration
const JUDGE0_API = "https://ce.judge0.com/submissions";

// Mapping of language keys to Judge0 Language IDs
// IDs obtained from https://ce.judge0.com/languages
const LANGUAGE_IDS = {
  javascript: 102, // Node.js 22.08.0
  typescript: 101, // TypeScript 5.6.2
  python: 109,     // Python 3.13.2
  java: 91,        // JDK 17.0.6
  cpp: 105,        // GCC 14.1.0
  c: 103,          // GCC 14.1.0
  csharp: 51,      // Mono 6.6.0.161
  go: 107,         // Go 1.23.5
  rust: 108,       // Rust 1.85.0
  php: 98,         // PHP 8.3.11
  ruby: 72,        // Ruby 2.7.0
  kotlin: 111,     // Kotlin 2.1.10
  swift: 83,       // Swift 5.2.3
};

/**
 * @param {string} language - programming language key
 * @param {string} code - source code to execute
 * @returns {Promise<{success:boolean, output?:string, error?: string}>}
 */
export async function executeCode(language, code) {
  try {
    const langId = LANGUAGE_IDS[language.toLowerCase()];

    if (!langId) {
      return {
        success: false,
        error: `Unsupported language: ${language}`,
      };
    }

    const response = await fetch(`${JUDGE0_API}?base64_encoded=false&wait=true`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source_code: code,
        language_id: langId,
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP error! status: ${response.status}`,
      };
    }

    const data = await response.json();

    // Judge0 Response Handling
    // status.id: 3 is Accepted
    // compile_output: compilation errors
    // stderr: runtime errors
    // stdout: standard output

    if (data.status?.id !== 3 && data.status?.id !== 1 && data.status?.id !== 2) {
      // 1=In Queue, 2=Processing (shouldn't happen with wait=true often, but possible)
      // 3=Accepted.
      // 6=Compilation Error, 11=Runtime Error, etc.

      const errorMsg = data.compile_output || data.stderr || data.message || "Unknown execution error";
      return {
        success: false,
        output: data.stdout || "",
        error: errorMsg,
      };
    }

    // Even if status is 3 (Accepted), checking stderr is good practice, 
    // though usually stderr means non-zero exit code which Judge0 catches as Runtime Error (id 11) or just stderr output.
    if (data.stderr) {
      return {
        success: false,
        output: data.stdout || "",
        error: data.stderr,
      };
    }

    return {
      success: true,
      output: data.stdout || "No output",
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to execute code: ${error.message}`,
    };
  }
}
