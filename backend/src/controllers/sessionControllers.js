import  Session  from "../modules/Session.js"
import { chatClient, streamClient } from "../lib/stream.js"




export async function createSession(req,res){
    try {
        const {problem, difficulty}= req.body
        const userId = req.user._id
        const clerkId = req.user.clerkId

        if(!problem || difficulty){
            return res.status(400).json({message:"problem and difficulty are required"})
        }

        // generate a unique call id for stream video
        const callId =`session_${Date.now()}_${Math.random().toString(36).substring(7)}`

        // create session in db
        const session = await Session.create({problem, difficulty, host: userId, callId})

        //create stream video call
        await streamClient.video.call("default",callId).getOrCreate({data:{created_by_id:clerkId,custom:{problem,difficulty,sessionId:session._id.toString()}}})

        //chat messaging

        const channel= chatClient.channel("message",callId,{
            name:`${problem} Session`,
            created_by_id:clerkId,
            members:[clerkId]
        })

        await channel.create()

        res.status(201).json({session:session})


    } catch (error) {
        console.log("Error in createSession controller:",error.message)
        res.status(500).json({message:"internal server error"})
        
    }
}



export async function getActiveSession(req,res){}

export async function getMyRecentSession(req,res){}

export async function getSessionById(req,res){}

export async function joinSession(req,res){}

export async function endSession(req,res){}