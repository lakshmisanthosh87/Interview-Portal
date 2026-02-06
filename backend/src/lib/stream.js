import { StreamChat } from "stream-chat"
import { ENV } from "./env.js"

const apiKey = ENV.STREAM_API_KEY
const apiSecret = ENV.STREAM_API_SECRET

if (!apiKey || !apiSecret) {
  console.error("STREAM API keys are missing")
}

export const chatClient = StreamChat.getInstance(apiKey, apiSecret)

export const upsertStreamUser = async (userData) => {
  try {
    const res = await chatClient.upsertUsers([
      {
        id: userData.id,
        name: userData.name,
        image: userData.image,
      }
    ])

    console.log("Stream user upserted successfully", res)
    return res
  } catch (error) {
    console.error("Error upserting Stream user:", error)
    throw error
  }
}

export const deleteStreamUser = async (userId) => {
  try {
    await chatClient.deleteUser(userId)
    console.log("Stream user deleted successfully", userId)
  } catch (error) {
    console.error("Error deleting Stream user:", error)
  }
}