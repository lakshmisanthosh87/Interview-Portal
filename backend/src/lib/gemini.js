import { GoogleGenerativeAI } from "@google/generative-ai";
import { ENV } from "./env.js";

const genAI = new GoogleGenerativeAI(ENV.GEMINI_API_KEY);

console.log("Gemini API Key Configured:", !!ENV.GEMINI_API_KEY);

export const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
