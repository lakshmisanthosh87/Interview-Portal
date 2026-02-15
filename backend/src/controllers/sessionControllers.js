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

        res.status(201).json({ session: session })

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

        //get sessions where user is either host ror participant
        const sessions = await Session.find({
            status: "completed",
            $or: [{ host: userId }, { participant: userId }]
        })
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
            .populate("host", "name email profilImage clerkId")
            .populate("participant", "name email profileImage clerkId")
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

        if (session.host.toString() == userId.toString()) {
            return res.status(400).json({ message: "Host cannot join their own session as participant" })
        }
        // check if session is already full
        if (session.participant) {
            return res.status(409).json({ message: "session is full" })
        }

        session.participant = userId
        await session.save()

        const channel = chatClient.channel("messaging", session.callId)
        await channel.addMembers([clerkId])
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