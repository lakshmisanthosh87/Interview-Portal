import mongoose from "mongoose";

const problemSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String, // Storing as HTML or Markdown string
            required: true,
        },
        difficulty: {
            type: String,
            enum: ["easy", "medium", "hard"],
            required: true,
        },
        examples: [
            {
                input: String,
                output: String,
                explanation: String,
            },
        ],
        constraints: [
            {
                type: String,
            },
        ],
        starterCode: {
            type: Map,
            of: String, // Language -> Code
            default: {},
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        isCustom: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

const Problem = mongoose.model("Problem", problemSchema);

export default Problem;
