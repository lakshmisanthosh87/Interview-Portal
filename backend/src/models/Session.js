import mongoose from "mongoose"

const sessionSchema = new mongoose.Schema({
    title: {
        type: String,
        default: "Session"
    },
    // Support for multiple problems (existing list)
    problems: [{
        type: String,
        required: true
    }],
    // Support for multiple custom problems
    customProblems: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Problem"
    }],
    // Tracking active problem
    activeProblemIndex: {
        type: Number,
        default: 0
    },

    difficulty: {
        type: String,
        enum: ["easy", "medium", "hard"],
        required: true
    },
    host: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    participant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    status: {
        type: String,
        enum: ["active", "completed"],
        default: "active"
    },
    //stream videcall id
    callId: {
        type: String,
        default: "",
    },
    recordingUrl: {
        type: String,
        default: ""
    },
    allParticipants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }]
}, { timestamps: true })


const Session = mongoose.model("Session", sessionSchema)

export default Session