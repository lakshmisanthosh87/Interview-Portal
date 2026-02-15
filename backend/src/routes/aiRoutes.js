import express from "express";
import { getAICodeReview } from "../controllers/aiController.js";
import { protectRoute } from "../middleware/protectRoute.js";

const router = express.Router();

router.post("/analyze", protectRoute, getAICodeReview);

export default router;
