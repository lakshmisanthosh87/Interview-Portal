import { Inngest } from "inngest"
import { connectDB } from "./db.js"
import User from "../models/User.js"
import { deleteStreamUser } from "./stream.js"
import { upsertStreamUser } from './stream.js'


export const inngest = new Inngest({ id: "interview-portal" })

const syncUser = inngest.createFunction(
    { id: "sync-user" },
    { event: "clerk/user.created" },
    async ({ event }) => {
        console.log(" Inngest function triggered");
        await connectDB()
        console.log(" DB connected");
        console.log(event, "event")
        const { id, email_addresses, first_name, last_name, image_url } = event.data

        if (!id || !email_addresses) {
            console.warn("⚠️ Missing user data in event payload. Are you using the correct test event data?")
            return;
        }

        console.log("=============================")
        const newUser = {
            clerkId: id,
            email: email_addresses[0]?.email_address,
            name: `${first_name || ""} ${last_name || ""}`,
            profileImage: image_url,
        };

        console.log(newUser, "user data")

        // Use findOneAndUpdate to be idempotent
        const dbUserresponse = await User.findOneAndUpdate(
            { clerkId: newUser.clerkId },
            newUser,
            { upsert: true, new: true }
        );

        const upstremres = await upsertStreamUser({
            id: newUser.clerkId.toString(),
            name: newUser.name,
            image: newUser.profileImage,
        })


        console.log(upstremres)

        // Do this later : send a wlcome email here 
    }
)


const deleteUserFromDB = inngest.createFunction(
    { id: "delete-user-from-db" },
    { event: "clerk/user.deleted" },
    async ({ event }) => {
        await connectDB()

        const { id } = event.data

        if (!id) {
            console.warn("⚠️ Missing user ID in delete event payload. Skipping.")
            return;
        }

        await User.deleteOne({ clerkId: id })

        await deleteStreamUser(id.toString());
    }
)

export const functions = [syncUser, deleteUserFromDB]