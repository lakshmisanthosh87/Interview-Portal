import { model } from "../lib/gemini.js";

export const getAICodeReview = async (req, res) => {
    const { code, language, problemDescription } = req.body;

    if (!code || !language) {
        return res.status(400).json({ error: "Code and language are required" });
    }

    try {
        const prompt = `
      You are an expert code reviewer and interviewer. Analyze the following ${language} code provided by a candidate for the following problem:
      
      Problem Description:
      ${problemDescription || "Not provided"}

      Code:
      ${code}

      Analyze the code for:
      1. Time Complexity (Big-O)
      2. Space Complexity (Big-O)
      3. Correctness (Does it solve the problem? specific edge case failures?)
      4. Code Quality (0-10 score) & Readability (0-10 score)
      5. Optimization Suggestions
      6. Best Practices Issues (Naming, modularity, etc.)

      Return the response in strictly valid JSON format with the following structure (no markdown code blocks):
      {
        "timeComplexity": "...",
        "spaceComplexity": "...",
        "correctnessAnalysis": "...",
        "codeQualityScore": number, // 0-10
        "readabilityScore": number, // 0-10
        "optimizationSuggestions": ["suggestion1", "suggestion2"],
        "bestPracticesIssues": ["issue1", "issue2"],
        "improvedCode": "optional optimized code snippet if applicable", 
        "summary": "short summary of feedback"
      }
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log("AI Response:", text); // Debugging

        // Clean up potential markdown formatting if model adds it (e.g. ```json ... ```)
        let cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();

        // Attempt to parse JSON
        let jsonResponse;
        try {
            jsonResponse = JSON.parse(cleanedText);
        } catch (parseError) {
            console.error("Error parsing AI response:", parseError);
            // Fallback: try to extract JSON from text if mixed content
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    jsonResponse = JSON.parse(jsonMatch[0]);
                } catch (e) {
                    return res.status(500).json({ error: "Failed to parse AI response", raw: text });
                }
            } else {
                return res.status(500).json({ error: "Failed to parse AI response", raw: text });
            }
        }

        res.status(200).json(jsonResponse);

    } catch (error) {
        console.error("Error in getAICodeReview:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export const getAIHint = async (req, res) => {
    const { code, language, problemDescription } = req.body;

    if (!code || !language) {
        return res.status(400).json({ error: "Code and language are required" });
    }

    try {
        const prompt = `
      You are a senior technical interviewer helping a candidate.

      The candidate is solving a problem and needs a hint.
      
      Your goal is to explain the **core logic** without giving the full code.
      
      **Requirements for your response:**
      1. **Explain the Logic**: Clearly explain the idea (e.g., "Use two pointers," "Track the product of prefix," etc.).
      2. **Numeric Example**: Show a step-by-step walkthough with small numbers.
      3. **Visual Explanation**: Use simple ASCII or text visualization (e.g., [1, 2, 3] -> [1, 1*1, 1*2]) to show how data changes.
      4. **Conciseness**: Keep it brief but helpful. Do not write the full function code.

      If the user's code is "Product of Array Except Self", specifically explain the "Prefix and Suffix product" idea visually.

      Problem:
      ${problemDescription || "Not provided"}

      Candidate's Current Code (Language: ${language}):
      ${code} 
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        res.status(200).json({ hint: text });

    } catch (error) {
        console.error("Error in getAIHint:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};
