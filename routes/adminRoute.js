import express from "express"
import { adminLogin, adminLoginVerify, logout } from "../controllers/admin/adminController.js"
import { customerBlocking, customers } from "../controllers/admin/customerController.js"
import { addCategory, addCategoryUpdate, category, editCategory, editCategoryUpdate, validCategory } from "../controllers/admin/categoryController.js"
import upload from "../middlewares/multer.js"
import { addProductPage, addProducts, editProduct, productsPage, productStatus, updateProduct } from "../controllers/admin/productController.js"
import { adminCheck, adminCheckLogin, validateAddCategory, validateEditCategory } from "../middlewares/adminMiddleware.js"
import { validateAddProduct, validateEditProduct } from "../middlewares/validationProductMiddleware.js"
import { orders, orderStatus, singleOrder } from "../controllers/admin/orderController.js"

const router = express.Router()

router.get('/', (req, res) => {
    res.redirect('/admin/login')
})

router.get("/login",adminCheckLogin, adminLogin) //adminlogin to login

router.post("/login", adminLoginVerify)

// Customer Page

router.get("/customers",adminCheck, customers)

router.patch("/customers/:Id",adminCheck, customerBlocking) //post to patch


// Category Page

router.get("/category",adminCheck, category)

router.get("/addcategory",adminCheck, addCategory)

router.post("/addCategory",adminCheck, upload.single("fileUpload"),validateAddCategory, addCategoryUpdate)

router.patch("/category/:categoryId",adminCheck, validCategory)

router.get("/editCategory/:id",adminCheck, editCategory)

router.patch('/updateCategory/:categoryid',adminCheck, upload.single("fileUpload"),validateEditCategory, editCategoryUpdate)

//Product Page

router.get('/products',adminCheck, productsPage)

router.get('/addProduct',adminCheck, addProductPage)

router.post('/addProducts',adminCheck, upload.any(),validateAddProduct, addProducts)

router.get('/editProduct',adminCheck, editProduct)

router.put('/editProduct/:productid',adminCheck, upload.any(),validateEditProduct, updateProduct)

router.patch('/updateProduct',adminCheck, productStatus)

// order page

router.get('/order', adminCheck, orders)

router.get('/order/:orderId', adminCheck, singleOrder)

router.post('/order/:orderId/update-status', adminCheck, orderStatus)

//logout 

router.post('/logout', logout)

export default router