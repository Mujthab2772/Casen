import express from "express"
import { adminLoginGet, adminLoginPost } from "../controllers/admin/adminController.js"
import { customerBlocking, customerPagination, customerResetSearch, customerSearch, customersGet } from "../controllers/admin/customerController.js"
import { addCategory, addCategoryPost, categoryGet, editCategory, editCategoryGet, editCategoryPatch, searchCategory, validCategory } from "../controllers/admin/categoryController.js"
import upload from "../middlewares/multer.js"

const router = express.Router()

router.get("/adminLogin", adminLoginGet)

router.post("/adminLogin", adminLoginPost)

router.get("/customers", customersGet)

router.post("/customers/:Id", customerBlocking)

router.post("/customers", customerSearch)

router.post("/customer/reset", customerResetSearch)

router.post("/customer", customerPagination)

router.get("/category", categoryGet)

router.get("/addcategoryPage", addCategory)

router.post("/addCategory",upload.single("fileUpload"), addCategoryPost)

router.post("/searchCategory", searchCategory)

router.post("/category/:categoryId", validCategory)

router.get("/editCategory", editCategoryGet)

router.post("/editCategory/:id", editCategory)

router.patch('/updateCategory/:id',upload.single("fileUpload"), editCategoryPatch)


export default router