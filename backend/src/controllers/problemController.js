import Problem from "../models/Problem.js";

export const createProblem = async (req, res) => {
    try {
        const { title, description, difficulty, examples, constraints, starterCode } = req.body;
        const userId = req.user._id;

        if (!title || !description || !difficulty) {
            return res.status(400).json({ message: "Title, description, and difficulty are required" });
        }

        const newProblem = new Problem({
            title,
            description,
            difficulty,
            examples: examples || [],
            constraints: constraints || [],
            starterCode: starterCode || {},
            createdBy: userId,
            isCustom: true,
        });

        const savedProblem = await newProblem.save();

        res.status(201).json(savedProblem);
    } catch (error) {
        console.error("Error in createProblem:", error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};

export const getProblemById = async (req, res) => {
    try {
        const { id } = req.params;
        const problem = await Problem.findById(id);

        if (!problem) {
            return res.status(404).json({ message: "Problem not found" });
        }

        res.status(200).json(problem);
    } catch (error) {
        console.error("Error in getProblemById:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};
