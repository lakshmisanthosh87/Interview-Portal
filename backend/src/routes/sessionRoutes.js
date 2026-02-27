import express from "express"
import { protectRoute } from "../middleware/protectRoute.js"

import { createSession, getActiveSession, getMyRecentSession, getSessionById, joinSession, endSession, leaveSessionController, updateActiveProblem } from "../controllers/sessionControllers.js"


const router = express.Router()


router.post("/", protectRoute, createSession)
router.get("/active", protectRoute, getActiveSession)
router.get("/my-recent", protectRoute, getMyRecentSession)

router.get("/:id", protectRoute, getSessionById)
router.post("/:id/join", protectRoute, joinSession)
router.post("/:id/leave", protectRoute, leaveSessionController)
router.post("/:id/end", protectRoute, endSession)
router.patch("/:id/active-problem", protectRoute, updateActiveProblem)


export default router