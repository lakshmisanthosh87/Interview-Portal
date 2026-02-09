import express from 'express';
import path from 'path';
import cors from "cors";
import { serve } from "inngest/express";
import {clerkMiddleware}  from "@clerk/express"

import { ENV } from './lib/env.js';
import { connectDB } from './lib/db.js';
import { inngest, functions } from "./lib/inngest.js";
import { fileURLToPath } from "url";
import morgan from 'morgan'
import { ClerkExpressWithAuth } from '@clerk/clerk-sdk-node';
import { Webhook } from 'svix';
import bodyParser from 'body-parser';
import { protectRoute } from './middleware/protectRoute.js';
import chatRoutes from "./routes/chatRoutes.js"
import sessionRoutes from "./routes/sessionRoutes.js"

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(morgan("dev"));

console.log(__dirname)


// middleware
app.post('/api/webhooks', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  try {
    console.log("Webhook received");
    const payload = req.body;
    const headers = req.headers;

    const svix_id = headers["svix-id"];
    const svix_timestamp = headers["svix-timestamp"];
    const svix_signature = headers["svix-signature"];

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return res.status(400).json({ error: "Error occurred -- no svix headers" });
    }

    const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET);
    let evt;

    try {
      evt = wh.verify(payload, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      });
    } catch (err) {
      console.error('Error verifying webhook:', err);
      return res.status(400).json({ 'Error': err.message });
    }

    const { id } = evt.data;
    const eventType = evt.type;
    console.log(`Webhook with an ID of ${id} and type of ${eventType}`);
    console.log('Webhook body:', evt.data);

    await inngest.send({
      name: `clerk/${eventType}`,
      data: evt.data,
    });

    res.status(200).json({ response: 'Success' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

app.use(express.json());
const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.PROD_URL
];




app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(clerkMiddleware()) //this adds auth fields to req body : req.auth()


// API routes
app.use("/api/inngest", serve({ client: inngest, functions }));

app.use("/api/chat",chatRoutes)

app.use("/api/sessions",sessionRoutes)

app.get("/health", (req,res)=>{
  res.status(200).json({msg:"api is up and running"})
})


// Protected routes example - apply to specific routes or globally for /api
app.use('/api', ClerkExpressWithAuth());


app.get('/api', (req, res) => {
  res.json({ message: 'API working' });
});

if (ENV.NODE_ENV === 'production') {
  app.use(
    express.static(path.join(__dirname, '../../frontend/dist'))
  );

  app.get('*', (req, res) => {
    res.sendFile(
      path.join(__dirname, '../../frontend/dist/index.html')
    );
  });
}


connectDB().then(() => {
  app.listen(ENV.PORT, () => {
    console.log("server is running on port :", ENV.PORT);
  });
});
