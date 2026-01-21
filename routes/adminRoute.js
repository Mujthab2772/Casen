import express from "express"
import { adminLogin, adminLoginVerify, logout } from "../controllers/admin/adminController.js"
import { customerBlocking, customers } from "../controllers/admin/customerController.js"
import { addCategory, addCategoryUpdate, category, editCategory, editCategoryUpdate, validCategory } from "../controllers/admin/categoryController.js"
import upload from "../middlewares/multer.js"
import { addProductPage, addProducts, editProduct, productsPage, productStatus, updateProduct } from "../controllers/admin/productController.js"
import { adminCheck, adminCheckLogin, validateAddCategory, validateEditCategory } from "../middlewares/adminMiddleware.js"
import { validateAddProduct, validateEditProduct } from "../middlewares/validationProductMiddleware.js"
import { itemReturnStatus, itemStatus, orderReturnStatus, orders, orderStatus, singleOrder } from "../controllers/admin/orderController.js"
import { addNewCoupon, couponFetch, editActive, editCoupon, newCoupon, updateEditCoupon } from "../controllers/admin/couponController.js"
import { handleValidationErrors, validateCoupon } from "../middlewares/couponValidate.js"
import { newOffer, offerAdd, offerDetail, offerEdit, offerToggle, offerUpdate } from "../controllers/admin/offerController.js"
import { validateOfferCreation } from "../middlewares/offerMIddleware.js"
import { dashboard, salesReportController } from "../controllers/admin/dashBoardController.js"
import { authLimiter } from "../middlewares/rateLimiter.js"

const router = express.Router()

router.get('/', (req, res) => {
    res.redirect('/admin/login')
})

router.get("/login",adminCheckLogin, adminLogin) //adminlogin to login

router.post("/login", authLimiter, adminLoginVerify)

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

router.get('/order', adminCheck, orders);

router.get('/order/:orderId', adminCheck, singleOrder);

router.post('/order/:orderId/update-status', adminCheck, orderStatus);

router.post('/order/:orderId/item/:orderItemId/update-status', adminCheck, itemStatus);

router.post('/order/:orderId/item/:orderItemId/return-status', adminCheck, itemReturnStatus);

router.post('/order/:orderId/return-status', adminCheck, orderReturnStatus);

// coupon 

router.get('/coupons', adminCheck, couponFetch)

router.get('/coupon/new', adminCheck, newCoupon)

router.post('/coupon/new/add', adminCheck, validateCoupon, handleValidationErrors, addNewCoupon)

router.patch('/coupon/toggle/:couponCode', adminCheck, editActive)

router.get('/coupon/edit/:couponCode', adminCheck, editCoupon)

router.put('/coupon/edit/:couponCode', adminCheck, validateCoupon, handleValidationErrors, updateEditCoupon)

// offer

router.get('/offers', adminCheck, offerDetail)

router.get('/offer/add', adminCheck, newOffer)

router.post('/offer/add/new', adminCheck,validateOfferCreation, offerAdd)

router.get('/offer/edit/:id', adminCheck, offerEdit)

router.put('/offer/update/:offerId', adminCheck, offerUpdate)

router.patch('/offer/toggle/:offerId', adminCheck, offerToggle)

// dashboard

router.get('/dashboard', adminCheck, dashboard)

// Analytics

router.get('/analytics', adminCheck, salesReportController.getSalesReportPage);

router.get('/sales-reports/export/pdf', adminCheck, salesReportController.exportSalesReportPDF);

//logout 

router.post('/logout', logout)

export default router