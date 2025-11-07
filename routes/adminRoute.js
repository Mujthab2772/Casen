import express from "express"
import { adminLoginGet, adminLoginPost } from "../controllers/admin/adminController.js"
import { customerBlocking, customerPagination, customerResetSearch, customerSearch, customersGet } from "../controllers/admin/customerController.js"
import { addCategory, categoryGet } from "../controllers/admin/categoryController.js"

const router = express.Router()

router.get("/adminLogin", adminLoginGet)

router.post("/adminLogin", adminLoginPost)

router.get("/customers", customersGet)

router.post("/customers/:Id", customerBlocking)

router.post("/customers", customerSearch)

router.post("/customer/reset", customerResetSearch)

router.post("/customer", customerPagination)

router.get("/category", categoryGet)

router.get("/addcategory", addCategory)


export default router