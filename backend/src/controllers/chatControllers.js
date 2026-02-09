import { chatClient } from "../lib/stream.js";




export async function getStreamToken(req,res){
     try {
        //use clerkId for stream (not mongodb _id)=> it should match the id we have in the stream
        const token = chatClient.createToken(req.user.clerkId)
        res.status(200).json({
            token,
            userId: req.user.clerkId,
            userName:req.user.name,
            userImage:req.user.image
        })
     } catch (error) {
        consloe.log("error in getStreamToken controller:",error.message)
        res.status(500).json({message:"Internal server error"})
        
     }
}