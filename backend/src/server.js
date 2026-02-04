import express from 'express';
import path from 'path';
import cors from "cors";
import { serve } from "inngest/express";

import { ENV } from './lib/env.js';
import { connectDB } from './lib/db.js';
import { inngest, functions } from "./lib/inngest.js";
import { fileURLToPath } from "url";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


console.log(__dirname)


// middleware
app.use(express.json());
const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.PROD_URL
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));


// API routes
app.use("/api/inngest", serve({ client: inngest, functions }));

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
