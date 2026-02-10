// Piston API is a service for code execution

const PISTON_API = "https://emkc.org/api/v2/piston";

// Cache of known language → version mappings.
// Seeded with a few common ones, but extended dynamically from /runtimes
const LANGUAGE_VERSIONS = {
  javascript: { language: "javascript", version: "18.15.0" },
  python: { language: "python", version: "3.10.0" },
  java: { language: "java", version: "15.0.2" },
};

// Cached runtimes response from Piston to support many languages
let RUNTIME_CACHE = null;

function normalizeLanguage(language) {
  const raw = (language || "").toLowerCase().trim();

  const aliasMap = {
    js: "javascript",
    node: "javascript",
    "node.js": "javascript",
    "c++": "cpp",
    "c#": "csharp",
    "c sharp": "csharp",
    "f#": "fsharp",
    ts: "typescript",
    "ts-node": "typescript",
  };

  return aliasMap[raw] || raw;
}

async function getLanguageConfig(language) {
  const normalized = normalizeLanguage(language);

  // Return from in-memory cache if available
  if (LANGUAGE_VERSIONS[normalized]) {
    return LANGUAGE_VERSIONS[normalized];
  }

  // Lazy-load runtimes from Piston once
  if (!RUNTIME_CACHE) {
    try {
      const res = await fetch(`${PISTON_API}/runtimes`);
      if (!res.ok) {
        return null;
      }
      RUNTIME_CACHE = await res.json();
    } catch {
      return null;
    }
  }

  if (!Array.isArray(RUNTIME_CACHE)) {
    return null;
  }

  const lower = normalized;

  // Try to match by language name or any alias
  const runtime = RUNTIME_CACHE.find(rt => {
    if (!rt || !rt.language) return false;
    const langMatch = rt.language.toLowerCase() === lower;

    const aliases = Array.isArray(rt.aliases) ? rt.aliases : [];
    const aliasMatch = aliases.some(a => (a || "").toLowerCase() === lower);

    return langMatch || aliasMatch;
  });

  if (!runtime) {
    return null;
  }

  const config = {
    language: runtime.language,
    version: runtime.version,
  };

  // Cache for future calls
  LANGUAGE_VERSIONS[normalized] = config;

  return config;
}

/**
 * @param {string} language - programming language (e.g. 'cpp', 'c', 'go', 'rust', etc.)
 * @param {string} code - source code to executed
 * @returns {Promise<{success:boolean, output?:string, error?: string}>}
 */
export async function executeCode(language, code) {
  try {
    const languageConfig = await getLanguageConfig(language);

    if (!languageConfig) {
      return {
        success: false,
        error: `Unsupported language: ${language}`,
      };
    }

    const response = await fetch(`${PISTON_API}/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        language: languageConfig.language,
        version: languageConfig.version,
        files: [
          {
            name: `main.${getFileExtension(language)}`,
            content: code,
          },
        ],
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP error! status: ${response.status}`,
      };
    }

    const data = await response.json();

    const output = data.run.output || "";
    const stderr = data.run.stderr || "";

    if (stderr) {
      return {
        success: false,
        output: output,
        error: stderr,
      };
    }

    return {
      success: true,
      output: output || "No output",
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to execute code: ${error.message}`,
    };
  }
}

function getFileExtension(language) {
  const normalized = normalizeLanguage(language);

  const extensions = {
    javascript: "js",
    typescript: "ts",
    python: "py",
    java: "java",
    cpp: "cpp",
    c: "c",
    csharp: "cs",
    go: "go",
    rust: "rs",
    php: "php",
    ruby: "rb",
    kotlin: "kt",
    swift: "swift",
    r: "r",
    dart: "dart",
    haskell: "hs",
    scala: "scala",
    perl: "pl",
  };

  return extensions[normalized] || "txt";
}