import { StreamChat } from "stream-chat";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load .env from parent directory (backend root)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const apiKey = process.env.STREAM_API_KEY;
const apiSecret = process.env.STREAM_API_SECRET;

console.log("Checking keys...");
console.log("API Key present:", !!apiKey);
console.log("API Secret present:", !!apiSecret);

if (!apiKey || !apiSecret) {
    console.error("❌ Missing Stream keys in .env");
    process.exit(1);
}

const client = StreamChat.getInstance(apiKey, apiSecret);

async function testUpsert() {
    try {
        console.log("Attempting to upsert test user...");
        const response = await client.upsertUsers([
            {
                id: "manual_test_user_1",
                name: "Manual Test User",
                image: "https://getstream.io/random_png?id=manual_test_user_1&name=Manual+Test+User"
            }
        ]);
        console.log("✅ Stream Connection Success! User 'manual_test_user_1' upserted.");
    } catch (err) {
        console.error("❌ Stream Error:", err);
    }
}

testUpsert();
