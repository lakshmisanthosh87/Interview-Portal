// src/data/Problems.js
import rawProblems from "./merged_problems.json";

// `merged_problems.json` has the shape:
// {
//   "questions": [ { ...problem fields... } ]
// }
// We want a flat array of problem objects for the UI.
export const PROBLEMS = rawProblems.questions || [];

// Language configuration for the code editor
// Icons are from devicons (via CDN)
export const LANGUAGE_CONFIG = {
  javascript: {
    name: "JavaScript",
    monacoLang: "javascript",
    icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg",
  },
  python: {
    name: "Python",
    monacoLang: "python",
    icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg",
  },
  java: {
    name: "Java",
    monacoLang: "java",
    icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/java/java-original.svg",
  },
  cpp: {
    name: "C++",
    monacoLang: "cpp",
    icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/cplusplus/cplusplus-original.svg",
  },
  c: {
    name: "C",
    monacoLang: "c",
    icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/c/c-original.svg",
  },
  csharp: {
    name: "C#",
    monacoLang: "csharp",
    icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/csharp/csharp-original.svg",
  },
  typescript: {
    name: "TypeScript",
    monacoLang: "typescript",
    icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg",
  },
  go: {
    name: "Go",
    monacoLang: "go",
    icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/go/go-original.svg",
  },
  rust: {
    name: "Rust",
    monacoLang: "rust",
    icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/rust/rust-plain.svg",
  },
  php: {
    name: "PHP",
    monacoLang: "php",
    icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/php/php-original.svg",
  },
  ruby: {
    name: "Ruby",
    monacoLang: "ruby",
    icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/ruby/ruby-original.svg",
  },
  kotlin: {
    name: "Kotlin",
    monacoLang: "kotlin",
    icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/kotlin/kotlin-original.svg",
  },
  swift: {
    name: "Swift",
    monacoLang: "swift",
    icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/swift/swift-original.svg",
  },
};