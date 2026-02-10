// src/data/Problems.js
import rawProblems from "./merged_problems.json";

// `merged_problems.json` has the shape:
// {
//   "questions": [ { ...problem fields... } ]
// }
// We want a flat array of problem objects for the UI.
export const PROBLEMS = rawProblems.questions || [];