import Session from "../models/Session.js"
import { chatClient, streamClient } from "../lib/stream.js"




export async function createSession(req, res) {
    try {
        const { problem, difficulty, customProblemId } = req.body
        const userId = req.user._id
        const clerkId = req.user.clerkId

        if (!problem || !difficulty) {
            return res.status(400).json({ message: "problem and difficulty are required" })
        }

        // generate a unique call id for stream video
        const callId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`

        // create session in db first
        const session = await Session.create({
            problem,
            difficulty,
            host: userId,
            callId,
            customProblemId: customProblemId || null
        })

        // Try to create stream video call (don't fail if Stream API fails)
        try {
            await streamClient.video.call("default", callId).getOrCreate({
                data: {
                    created_by_id: clerkId,
                    members: [{ user_id: clerkId, role: "admin" }], // Add host as member
                    custom: {
                        problem,
                        difficulty,
                        sessionId: session._id.toString()
                    }
                }
            })
        } catch (streamError) {
            console.log("Warning: Failed to create Stream video call:", streamError.message)
            // Continue even if Stream video call fails
        }

        // Try to create chat channel (don't fail if Stream API fails)
        try {
            const channel = chatClient.channel("messaging", callId, {
                name: `${problem} Session`,
                created_by_id: clerkId,
                members: [clerkId]
            })

            await channel.create()
        } catch (chatError) {
            console.log("Warning: Failed to create Stream chat channel:", chatError.message)
            // Continue even if Stream chat channel fails
        }

        const sessionLink = `${process.env.CLIENT_URL || "http://localhost:5173"}/session/${session._id}`
        res.status(201).json({ session, sessionLink })

    } catch (error) {
        console.log("Error in createSession controller:", error.message)
        console.log("Full error:", error)
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

        //get sessions where user is either host or participant
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
            .populate("customProblemId")

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

        // Allow host to re-join without taking a participant slot
        if (session.host.toString() === userId.toString()) {
            return res.status(200).json({ session, message: "Host re-joined" });
        }

        // Strict 2-person limit: check if someone else is already the participant
        if (session.participant && session.participant.toString() !== userId.toString()) {
            return res.status(409).json({ message: "Session is full. Only 2 participants (1 host + 1 guest) allowed." })
        }

        if (!session.participants.includes(userId)) {
            session.participants.push(userId)
        }

        // Set the primary participant field
        if (!session.participant) {
            session.participant = userId
        }
        await session.save()

        const channel = chatClient.channel("messaging", session.callId)
        await channel.addMembers([clerkId])

        // Add to Stream Video Call members as well
        try {
            const videoCall = streamClient.video.call("default", session.callId);
            await videoCall.updateCallMembers({
                add_members: [{ user_id: clerkId, role: "user" }]
            });
            console.log(`[JoinSession] Added ${clerkId} to Stream Video call members`);
        } catch (videoError) {
            console.log("Warning: Failed to add participant to Stream Video call:", videoError.message);
        }

        res.status(200).json({ session })
    } catch (error) {

        console.log("error in JoinSession controller:", error.message)
        res.status(500).json({ message: "Internal server error" })
    }
}

export async function endSession(req, res) {
    try {
        const { id } = req.params
        const userId = req.user._id
        const session = await Session.findById(id)

        if (!session) {
            return res.status(404).json({ message: "Session not found" })
        }

        if (session.host.toString() !== userId.toString()) {
            return res.status(403).json({ message: "only the host can end the session" })
        }

        if (session.status === "completed") {
            return res.status(400).json({ message: "Session is already completed" })
        }


        const call = streamClient.video.call("default", session.callId)
        await call.delete({ hard: true })


        const channel = chatClient.channel("messaging", session.callId)
        await channel.delete()

        session.status = "completed"
        await session.save()


        res.status(200).json({ session, message: "Session ended successfully" })
    }
    catch (error) {
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

        if (!session) {
            return res.status(404).json({ message: "Session not found" })
        }

        // If host leaves, we don't end the session here (they might just be refreshing)
        // unless they explicitly end it. But for participants:
        if (session.participant?.toString() === userId.toString()) {
            session.participant = null;
        }

        // Remove from current participants array
        session.participants = session.participants.filter(p => p.toString() !== userId.toString());

        await session.save()

        // Optional: Remove from Stream Chat/Video members if you want to be strict
        try {
            const channel = chatClient.channel("messaging", session.callId)
            await channel.removeMembers([clerkId])

            const videoCall = streamClient.video.call("default", session.callId)
            await videoCall.updateCallMembers({
                remove_members: [clerkId]
            })
        } catch (streamError) {
            console.log("Warning: Failed to remove member from Stream on leave:", streamError.message)
        }

        res.status(200).json({ message: "Left session successfully" })
    } catch (error) {
        console.log("error in leaveSession controller:", error.message)
        res.status(500).json({ message: "Internal server error" })
    }
}