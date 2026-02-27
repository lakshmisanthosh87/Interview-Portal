import Session from "../models/Session.js"
import { chatClient, streamClient } from "../lib/stream.js"

export async function createSession(req, res) {
    try {
        const { problems, difficulty, customProblems } = req.body
        const userId = req.user._id
        const clerkId = req.user.clerkId

        // Validation for multiple problems
        if ((!problems || problems.length === 0) && (!customProblems || customProblems.length === 0)) {
            return res.status(400).json({ message: "At least one problem is required" })
        }

        if (!difficulty) {
            return res.status(400).json({ message: "difficulty is required" })
        }

        // generate a unique call id for stream video
        const callId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`

        // create session in db
        const session = await Session.create({
            problems: problems || [],
            customProblems: customProblems || [],
            difficulty,
            host: userId,
            callId,
            activeProblemIndex: 0
        })

        const displayTitle = problems?.[0] || "Custom Problem";

        // Try to create stream video call
        try {
            await streamClient.video.call("default", callId).getOrCreate({
                data: {
                    created_by_id: clerkId,
                    members: [{ user_id: clerkId, role: "admin" }],
                    custom: {
                        problems: problems || [],
                        difficulty,
                        sessionId: session._id.toString()
                    }
                }
            })
        } catch (streamError) {
            console.log("Warning: Failed to create Stream video call:", streamError.message)
        }

        // Try to create chat channel
        try {
            const channel = chatClient.channel("messaging", callId, {
                name: `${displayTitle} Session`,
                created_by_id: clerkId,
                members: [clerkId]
            })

            await channel.create()
        } catch (chatError) {
            console.log("Warning: Failed to create Stream chat channel:", chatError.message)
        }

        const sessionLink = `${process.env.CLIENT_URL || "http://localhost:5173"}/session/${session._id}`
        res.status(201).json({ session, sessionLink })

    } catch (error) {
        console.log("Error in createSession controller:", error.message)
        res.status(500).json({ message: "internal server error", error: error.message })
    }
}

export async function getActiveSession(req, res) {
    try {
        const sessions = await Session.find({ status: "active" })
            .populate("host", "name profileImage email clerkId")
            .populate("participant", "name profileImage email clerkId")
            .populate("participants", "name profileImage email clerkId")
            .sort({ createdAt: -1 })
            .limit(20)

        res.status(200).json({ sessions })
    } catch (error) {
        console.log("Error in getActiveSessions controller:", error.message)
        res.status(500).json({ message: "internal server error" })
    }
}

export async function getMyRecentSession(req, res) {
    try {
        const userId = req.user._id

        const sessions = await Session.find({
            status: "completed",
            $or: [{ host: userId }, { participant: userId }, { participants: userId }]
        })
            .populate("host", "name profileImage email clerkId")
            .populate("participant", "name profileImage email clerkId")
            .populate("participants", "name profileImage email clerkId")
            .sort({ createdAt: -1 })
            .limit(20)

        res.status(200).json({ sessions })
    } catch (error) {
        console.log("Error in getMyRecentSession controller:", error.message)
        res.status(500).json({ message: "internal server error" })
    }
}

export async function getSessionById(req, res) {
    try {
        const { id } = req.params

        const session = await Session.findById(id)
            .populate("host", "name email profileImage clerkId")
            .populate("participant", "name email profileImage clerkId")
            .populate("participants", "name email profileImage clerkId")
            .populate("customProblems"); // Populate multiple custom problems

        if (!session) {
            return res.status(404).json({ message: "Session not found" })
        }

        res.status(200).json({ session })

    } catch (error) {
        console.log("Error in getSessionById controllers:", error.message)
        res.status(500).json({ message: "Internal server error" })
    }
}

export async function joinSession(req, res) {
    try {
        const { id } = req.params
        const userId = req.user._id
        const clerkId = req.user.clerkId

        const session = await Session.findById(id)

        if (!session) {
            return res.status(404).json({ message: "Session not found" })
        }

        if (session.status !== "active") {
            return res.status(400).json({ message: "cannot join a completed session" })
        }

        if (session.host.toString() === userId.toString()) {
            return res.status(200).json({ session, message: "Host re-joined" });
        }

        if (session.participant && session.participant.toString() !== userId.toString()) {
            return res.status(409).json({ message: "Session is full. Only 2 participants allowed." })
        }

        if (!session.participants.includes(userId)) {
            session.participants.push(userId)
        }

        if (!session.participant) {
            session.participant = userId
        }
        await session.save()

        const channel = chatClient.channel("messaging", session.callId)
        await channel.addMembers([clerkId])

        try {
            const videoCall = streamClient.video.call("default", session.callId);
            await videoCall.updateCallMembers({
                add_members: [{ user_id: clerkId, role: "user" }]
            });
        } catch (videoError) {
            console.log("Warning: Failed to add participant to Stream Video call:", videoError.message);
        }

        const populatedSession = await Session.findById(id)
            .populate("host", "name email profileImage clerkId")
            .populate("participant", "name email profileImage clerkId")
            .populate("participants", "name email profileImage clerkId")
            .populate("customProblems");

        res.status(200).json({ session: populatedSession })
    } catch (error) {
        console.log("error in JoinSession controller:", error.message)
        res.status(500).json({ message: "Internal server error" })
    }
}

export async function updateActiveProblem(req, res) {
    try {
        const { id } = req.params;
        const { activeProblemIndex } = req.body;
        const userId = req.user._id;

        const session = await Session.findById(id);
        if (!session) return res.status(404).json({ message: "Session not found" });

        const isHost = session.host.toString() === userId.toString();
        const isParticipant = session.participant?.toString() === userId.toString();

        if (!isHost && !isParticipant) {
            return res.status(403).json({ message: "Only participants in the session can switch problems" });
        }

        session.activeProblemIndex = activeProblemIndex;
        await session.save();

        res.status(200).json({ session, message: "Active problem updated" });
    } catch (error) {
        console.log("Error in updateActiveProblem:", error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function endSession(req, res) {
    try {
        const { id } = req.params
        const userId = req.user._id
        const session = await Session.findById(id)

        if (!session) return res.status(404).json({ message: "Session not found" })
        if (session.host.toString() !== userId.toString()) {
            return res.status(403).json({ message: "only the host can end the session" })
        }
        if (session.status === "completed") return res.status(400).json({ message: "Session already completed" })

        const call = streamClient.video.call("default", session.callId)
        await call.delete({ hard: true })

        const channel = chatClient.channel("messaging", session.callId)
        await channel.delete()

        session.status = "completed"
        await session.save()

        res.status(200).json({ session, message: "Session ended successfully" })
    } catch (error) {
        console.log("error in endSession controller:", error.message)
        res.status(500).json({ message: "Internal server error" })
    }
}

export async function leaveSessionController(req, res) {
    try {
        const { id } = req.params
        const userId = req.user._id
        const clerkId = req.user.clerkId

        const session = await Session.findById(id)
        if (!session) return res.status(404).json({ message: "Session not found" })

        if (session.participant?.toString() === userId.toString()) {
            session.participant = null;
        }

        session.participants = session.participants.filter(p => p.toString() !== userId.toString());
        await session.save()

        try {
            const channel = chatClient.channel("messaging", session.callId)
            await channel.removeMembers([clerkId])
        } catch (streamError) {
            console.log("Warning: Failed to remove member on leave:", streamError.message)
        }

        res.status(200).json({ message: "Left session successfully" })
    } catch (error) {
        console.log("error in leaveSession controller:", error.message)
        res.status(500).json({ message: "Internal server error" })
    }
}