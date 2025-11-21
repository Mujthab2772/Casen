import express from "express"
import { adminLogin, adminLoginVerify, logout } from "../controllers/admin/adminController.js"
import { customerBlocking, customers } from "../controllers/admin/customerController.js"
import { addCategory, addCategoryUpdate, category, editCategory, editCategoryUpdate, validCategory } from "../controllers/admin/categoryController.js"
import upload from "../middlewares/multer.js"
import { addProductPage, addProducts, editProduct, productsPage, productStatus, updateProduct } from "../controllers/admin/productController.js"
import { adminCheck, adminCheckLogin } from "../middlewares/adminMiddleware.js"

const router = express.Router()

router.get('/', (req, res) => {
    res.redirect('/admin/login')
})

router.get("/login",adminCheckLogin, adminLogin) //adminlogin to login

router.post("/login", adminLoginVerify)

// Customer Page

router.get("/customers",adminCheck, customers)

router.patch("/customers/:Id", customerBlocking) //post to patch


// Category Page

router.get("/category",adminCheck, category)

router.get("/addcategory",adminCheck, addCategory)

router.post("/addCategory", upload.single("fileUpload"), addCategoryUpdate)

router.patch("/category/:categoryId", validCategory)

router.get("/editCategory/:id",adminCheck, editCategory)

router.patch('/updateCategory/:categoryid', upload.single("fileUpload"), editCategoryUpdate)

//Product Page

router.get('/products',adminCheck, productsPage)

router.get('/addProduct',adminCheck, addProductPage)

router.post('/addProducts', upload.any(), addProducts)

router.get('/editProduct',adminCheck, editProduct)

router.put('/editProduct/:productid', upload.any(), updateProduct)

router.patch('/updateProduct', productStatus)

//logout 

router.post('/logout', logout)

export default router