import express from "express"
import { adminLoginGet, adminLoginPost, customerBlocking, customersGet } from "../controllers/adminController.js"

const router = express.Router()

router.get("/adminLogin", adminLoginGet)

router.post("/adminLogin", adminLoginPost)

router.get("/customers", customersGet)

router.post("/customers/:customerId", customerBlocking)


export default router