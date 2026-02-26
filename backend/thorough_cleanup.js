import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const userSchema = new mongoose.Schema({
    name: String,
    clerkId: String,
}, { strict: false });

const User = mongoose.model('User', userSchema);

const DB_URL = process.env.DB_URL;

async function cleanup() {
    if (!DB_URL) {
        console.error("DB_URL not found in .env");
        return;
    }
    
    try {
        await mongoose.connect(DB_URL);
        console.log("Connected to DB");
        
        const allUsers = await User.find({});
        console.log(`Total users in DB: ${allUsers.length}`);
        
        for (const user of allUsers) {
            if (user.name && (user.name.includes('$') || user.name.includes('{'))) {
                console.log(`Fixing corrupted name for ${user.clerkId}: "${user.name}"`);
                
                // Aggressive cleanup for literal interpolation tags
                let newName = user.name
                    .replace(/[$][{(]first_name.*?}/g, "")
                    .replace(/[$][{(]last_name.*?}/g, "")
                    .replace(/["']/g, "")
                    .replace(/[|}]{1,2}/g, "") // remove stray brackets/pipes
                    .trim();
                
                if (!newName || newName.toLowerCase().includes("undefined")) newName = "User";
                
                user.name = newName;
                await user.save();
                console.log(`  -> Updated to: "${user.name}"`);
            }
        }
        
        console.log("Thorough cleanup complete!");
    } catch (error) {
        console.error("Cleanup failed:", error);
    } finally {
        await mongoose.disconnect();
    }
}

cleanup();
