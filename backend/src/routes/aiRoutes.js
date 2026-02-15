import express from "express";
import { getAICodeReview, getAIHint } from "../controllers/aiController.js";
import { protectRoute } from "../middleware/protectRoute.js";

const router = express.Router();

router.post("/analyze", protectRoute, getAICodeReview);
router.post("/hint", protectRoute, getAIHint);

export default router;
