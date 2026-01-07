import express from "express"
import { otpPage, otpPagePost, resendOtp, signUpPageGet, signUpPost } from "../controllers/user/signupController.js"
import { resetPasswordValidate, validateSignUp } from "../middlewares/validationMiddleware.js"
import { googleAuth, googleAuthCallback } from "../controllers/user/googleAuthController.js"
import { forgotOtpPage, forgotOtpVerify, forgotPass, forgotPassResetPost, login, loginGet, resendforgotOtp, resetPassword, resetPasswordVerify } from "../controllers/user/loginController.js"
import { landingPage, logout } from "../controllers/user/landingPage.js"
import { fetchProducts, singleProduct } from "../controllers/user/productsController.js"
import { preventAuthAccess, requireActiveUser, userProfile } from "../middlewares/userMiddleware.js"
import { editProfile, newPassword, otpResend, otpVerify, ProfileUser, setNewPass, updateProfile, verifyEmail } from "../controllers/user/profileController.js"
import upload from "../middlewares/multer.js"
import { address, addressEdit, addressEditUpdate, addressFetch, addressNew, deleteAddress } from "../controllers/user/addressController.js"
import { validateAddress } from "../middlewares/addressMiddleware.js"
import { cart, newCart, removeCart, updateCart } from "../controllers/user/cartController.js"
import { checkout, checkoutDatas, getAvailableCoupons, previewCheckout } from "../controllers/user/checkoutController.js"
import { payment, paymentFail, paymentProcess, paymentSuccess, verifyPayment } from "../controllers/user/paymentController.js"
import { exitsCheckout } from "../middlewares/checkoutMiddleware.js"
import { cancelItem, cancelOrder, orderListing, returnProduct } from "../controllers/user/orderController.js"
import { validateProfileUpdate } from "../middlewares/validateProfileUpdate.js"
import { wishlist, wishlistadd, wishlistRemove } from "../controllers/user/wishlistController.js"



const router = express.Router()

router.get('/signUpPage',preventAuthAccess, signUpPageGet)

router.post('/signup', preventAuthAccess,validateSignUp, signUpPost)

router.get('/signUpOtp',preventAuthAccess, otpPage)

router.post('/otpverify/signupVerify',preventAuthAccess, otpPagePost)

router.post('/resendOtp/signupVerify',preventAuthAccess, resendOtp)

router.get('/auth/google',preventAuthAccess, googleAuth)

router.get('/auth/google/callback',preventAuthAccess, googleAuthCallback)

router.get('/login',preventAuthAccess, loginGet)

router.post('/login',preventAuthAccess, login)

router.get('/forgotPassword',preventAuthAccess, forgotPass)

router.post('/forgotPassword',preventAuthAccess, forgotPassResetPost)

router.get("/forgotOtp",preventAuthAccess, forgotOtpPage)

router.post('/forgotOtpVerify',preventAuthAccess, forgotOtpVerify)

router.post('/resendForgotOtp',preventAuthAccess, resendforgotOtp)

router.get('/resetPasswordPage',preventAuthAccess, resetPassword)

router.patch('/resetPassword',preventAuthAccess, resetPasswordValidate, resetPasswordVerify)


/// landing Page

router.get('/',requireActiveUser, landingPage)

router.get('/products',requireActiveUser, fetchProducts)

router.get('/product',requireActiveUser, singleProduct)

router.post('/logout', logout)

// user Profile

router.get('/profile', userProfile, ProfileUser)

router.get('/profile/edit', userProfile, editProfile)

router.put('/profile/edit', userProfile, upload.single("profilePic"), validateProfileUpdate, updateProfile)

router.get('/profile/email/otp', userProfile, verifyEmail)

router.post('/otpverify/emailVerify', userProfile, otpVerify)

router.post('/resendOtp/emailVerify',userProfile, otpResend)

//address

router.get('/profile/address', userProfile, address)

router.get('/profile/newAddress', userProfile, addressFetch)

router.post('/profile/addAddress', userProfile, validateAddress, addressNew)

router.get('/profile/editAddress', userProfile, addressEdit)

router.put('/profile/editAddress/update', userProfile, validateAddress, addressEditUpdate)

router.delete('/profile/deleteAddress', userProfile, deleteAddress)

// cart 

router.get('/cart', userProfile, cart)

router.post('/cart/add', userProfile, newCart)

router.put('/cart/update', userProfile, updateCart)

router.delete('/cart/remove', userProfile, removeCart)

// checkout

router.get('/checkout', userProfile, checkout)

router.post('/checkout/process', userProfile, checkoutDatas)

router.post('/checkout/preview', userProfile, previewCheckout);

router.get('/coupons',userProfile, getAvailableCoupons);


// payment 

router.get('/payment', userProfile, payment)

router.post('/payment/process', userProfile, paymentProcess)

router.get('/payment/verify', userProfile, verifyPayment)

// success payment 

router.get('/payment/success', userProfile, paymentSuccess)

router.get('/payment/fail', userProfile, paymentFail)

// order Profile 

router.get('/profile/orders', userProfile, orderListing)

router.put('/profile/orders/:orderId/items/:itemIndex/cancel', userProfile, cancelItem)

router.patch('/profile/orders/:orderId/cancel', userProfile, cancelOrder)

router.patch('/profile/orders/:orderId/return', userProfile, returnProduct)

//wishlist

router.get('/profile/wishlist', userProfile, wishlist)

router.post('/profile/wishlist/add', userProfile, wishlistadd)

router.delete('/wishlist/remove', userProfile, wishlistRemove)

// password 

router.get('/profile/newPassword', userProfile, newPassword)

router.put('/password', userProfile, setNewPass)

export default router 