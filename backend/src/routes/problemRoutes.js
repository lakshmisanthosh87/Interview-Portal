import express from "express";
import { createProblem, getProblemById, getAllProblems } from "../controllers/problemController.js";
import { protectRoute } from "../middleware/protectRoute.js";

const router = express.Router();

router.get("/", protectRoute, getAllProblems);
router.post("/", protectRoute, createProblem);
router.get("/:id", protectRoute, getProblemById);

export default router;
