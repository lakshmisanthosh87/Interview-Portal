import express from "express"
import { protectRoute } from "../middleware/protectRoute.js"

import { createSession , getActiveSession, getMyRecentSession,getSessionById,joinSession,endSession } from "../controllers/sessionControllers.js"


const router = express.Router()


router.post("/",protectRoute,createSession)
router.get("/active",protectRoute,getActiveSession)
router.get("/my-recent",protectRoute,getMyRecentSession)

router.get("/:id",protectRoute,getSessionById)
router.get("/:id/join",protectRoute,joinSession)
router.get("/:id/end",protectRoute,endSession)


export default router