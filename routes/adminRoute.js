import express from "express"
import { adminLoginGet, adminLoginPost } from "../controllers/adminController.js"

const router = express.Router()

router.get("/adminLogin", adminLoginGet)

router.post("/adminLogin", adminLoginPost)


export default router