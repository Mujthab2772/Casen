import express from "express"
import { adminLoginGet, adminLoginPost, customerBlocking, customerPagination, customerResetSearch, customerSearch, customersGet } from "../controllers/adminController.js"

const router = express.Router()

router.get("/adminLogin", adminLoginGet)

router.post("/adminLogin", adminLoginPost)

router.get("/customers", customersGet)

router.post("/customers/:Id", customerBlocking)

router.post("/customers", customerSearch)

router.post("/customer/reset", customerResetSearch)

router.post("/customer", customerPagination)


export default router