import fetch from "node-fetch";

const API_URL = "http://localhost:5000/api/ai/analyze";

const testPayload = {
    code: `
    function twoSum(nums, target) {
      for (let i = 0; i < nums.length; i++) {
        for (let j = i + 1; j < nums.length; j++) {
          if (nums[i] + nums[j] === target) {
            return [i, j];
          }
        }
      }
      return [];
    }
  `,
    language: "javascript",
    problemDescription: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target."
};

console.log("Testing AI Analysis Endpoint...");

async function runTest() {
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(testPayload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        console.log("✅ API Success! Response received:");
        console.log(JSON.stringify(data, null, 2));

        // Basic validation
        if (data.timeComplexity && data.codeQualityScore) {
            console.log("✅ Response structure looks correct.");
        } else {
            console.error("❌ Response structure invalid.");
        }

    } catch (error) {
        console.error("❌ Test Failed:", error.message);
    }
}

runTest();
