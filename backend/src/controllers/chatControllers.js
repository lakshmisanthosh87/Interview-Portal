import { chatClient } from "../lib/stream.js";




export async function getStreamToken(req, res) {
   try {
      //use clerkId for stream (not mongodb _id)=> it should match the id we have in the stream
      const token = chatClient.createToken(req.user.clerkId)

      // Fallback cleanup for interpolation bug in name (e.g. if name literally has ${first_name || ""})
      let cleanName = req.user.name || "";
      if (cleanName.includes('${first_name')) {
         cleanName = cleanName.replace(/\${first_name\s*\|\|\s*""}/g, "").trim();
      }

      res.status(200).json({
         token,
         userId: req.user.clerkId,
         userName: cleanName,
         userImage: req.user.image
      })
   } catch (error) {
      console.log("error in getStreamToken controller:", error.message)
      res.status(500).json({ message: "Internal server error" })

   }
}