import express from "express"
import { adminLogin, adminLoginVerify } from "../controllers/admin/adminController.js"
import { customerBlocking, customers, customerSearch } from "../controllers/admin/customerController.js"
import { addCategory, addCategoryUpdate, category, editCategory, editCategoryUpdate, validCategory } from "../controllers/admin/categoryController.js"
import upload from "../middlewares/multer.js"
import { addProductPage, addProductsPost, editProduct, productsPage } from "../controllers/admin/productController.js"

const router = express.Router()

router.get("/login", adminLogin) //adminlogin to login

router.post("/login", adminLoginVerify)

// Customer Page

router.get("/customers", customers)

router.patch("/customers/:Id", customerBlocking) //post to patch

router.post("/customers", customerSearch)

// Category Page

router.get("/category", category)

router.get("/addcategory", addCategory)

router.post("/addCategory", upload.single("fileUpload"), addCategoryUpdate)

router.patch("/category/:categoryId", validCategory)

router.get("/editCategory/:id", editCategory)

router.patch('/updateCategory/:categoryid', upload.single("fileUpload"), editCategoryUpdate)

//Product Page

router.get('/products', productsPage)

router.get('/addProduct', addProductPage)

router.post('/addProducts', upload.any(), addProductsPost)

router.patch('/editProductPage', editProduct)

export default router