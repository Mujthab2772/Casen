import express from "express"
import { otpPage, otpPagePost, resendOtp, signUpPageGet, signUpPost } from "../controllers/user/signupController.js"
import { resetPasswordValidate, validateSignUp } from "../middlewares/validationMiddleware.js"
import { googleAuth, googleAuthCallback } from "../controllers/user/googleAuthController.js"
import { forgotOtpPage, forgotOtpVerify, forgotPass, forgotPassResetPost, login, loginGet, resendforgotOtp, resetPassword, resetPasswordVerify } from "../controllers/user/loginController.js"
import { aboutSection, landingPage, logout } from "../controllers/user/landingPage.js"
import { fetchProducts, singleProduct } from "../controllers/user/productsController.js"
import { preventAuthAccess, requireActiveUser, userProfile } from "../middlewares/userMiddleware.js"
import { editProfile, newPassword, otpResend, otpVerify, ProfileUser, setNewPass, updateProfile, verifyEmail } from "../controllers/user/profileController.js"
import upload from "../middlewares/multer.js"
import { address, addressEdit, addressEditUpdate, addressFetch, addressNew, deleteAddress } from "../controllers/user/addressController.js"
import { validateAddress } from "../middlewares/addressMiddleware.js"
import { cart, checkInventoryRoute, newCart, removeCart, updateCart } from "../controllers/user/cartController.js"
import { checkout, checkoutDatas, getAvailableCoupons, previewCheckout } from "../controllers/user/checkoutController.js"
import { payment, paymentFail, paymentProcess, paymentSuccess, verifyPayment } from "../controllers/user/paymentController.js"
import { exitsCheckout } from "../middlewares/checkoutMiddleware.js"
import { cancelItem, cancelOrder, itemReturn, orderListing, returnProduct } from "../controllers/user/orderController.js"
import { validateProfileUpdate } from "../middlewares/validateProfileUpdate.js"
import { wishlist, wishlistadd, wishlistRemove } from "../controllers/user/wishlistController.js"
import { wallet, walletAddNew, walletNewView } from "../controllers/user/walletController.js"
import { referral } from "../controllers/user/referralController.js"



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

router.post('/resendForgotOtp',preventAuthAccess,  resendforgotOtp)

router.get('/resetPasswordPage',preventAuthAccess, resetPassword)

router.patch('/resetPassword',preventAuthAccess, resetPasswordValidate, resetPasswordVerify)


/// landing Page

router.get('/',requireActiveUser, landingPage)

router.get('/about', requireActiveUser, aboutSection)

router.get('/products',requireActiveUser, fetchProducts)

router.get('/product',requireActiveUser, singleProduct)

router.post('/logout', logout)

// user Profile

router.get('/profile', userProfile, requireActiveUser, ProfileUser)

router.get('/profile/edit', userProfile, requireActiveUser, editProfile)

router.put('/profile/edit', userProfile, requireActiveUser, upload.single("profilePic"), validateProfileUpdate, updateProfile)

router.get('/profile/email/otp', userProfile, requireActiveUser, verifyEmail)

router.post('/otpverify/emailVerify', userProfile, requireActiveUser, otpVerify)

router.post('/resendOtp/emailVerify',userProfile, requireActiveUser, otpResend)

//address

router.get('/profile/address', userProfile, requireActiveUser, address)

router.get('/profile/newAddress', userProfile, requireActiveUser, addressFetch)

router.post('/profile/addAddress', userProfile, requireActiveUser, validateAddress, addressNew)

router.get('/profile/editAddress', userProfile, requireActiveUser, addressEdit)

router.put('/profile/editAddress/update', userProfile, requireActiveUser, validateAddress, addressEditUpdate)

router.delete('/profile/deleteAddress', userProfile, requireActiveUser, deleteAddress)

// cart 

router.get('/cart', userProfile, requireActiveUser, cart)

router.post('/cart/add', userProfile, requireActiveUser, newCart)

router.put('/cart/update', userProfile, requireActiveUser, updateCart)

router.delete('/cart/remove', userProfile, requireActiveUser, removeCart)

router.post('/inventory/check',userProfile, requireActiveUser, checkInventoryRoute);

// checkout

router.get('/checkout', userProfile, requireActiveUser, checkout)

router.post('/checkout/process', userProfile, requireActiveUser, checkoutDatas)

router.post('/checkout/preview', userProfile, requireActiveUser, previewCheckout);

router.get('/coupons',userProfile, requireActiveUser, getAvailableCoupons);


// payment 

router.get('/payment', userProfile, requireActiveUser, payment)

router.post('/payment/process', userProfile, requireActiveUser, paymentProcess)

router.get('/payment/verify', userProfile, requireActiveUser, verifyPayment)

// success payment 

router.get('/payment/success', userProfile, requireActiveUser, paymentSuccess)

router.get('/payment/fail', userProfile, requireActiveUser, paymentFail)

// order Profile 

router.get('/profile/orders', userProfile, requireActiveUser, orderListing)

router.put('/profile/orders/:orderId/items/:itemIndex/cancel', userProfile, requireActiveUser, cancelItem)

router.patch('/profile/orders/:orderId/cancel', userProfile, requireActiveUser, cancelOrder)

router.patch('/profile/orders/:orderId/return', userProfile, requireActiveUser, returnProduct)

router.patch('/profile/orders/:orderId/items/:itemIndex/return', userProfile, requireActiveUser, itemReturn)

//wishlist

router.get('/profile/wishlist', userProfile, requireActiveUser, wishlist)

router.post('/profile/wishlist/add', userProfile, requireActiveUser, wishlistadd)

router.delete('/wishlist/remove', userProfile, requireActiveUser, wishlistRemove)

//Wallet

router.get('/profile/wallet', userProfile, requireActiveUser, wallet)

router.get('/profile/wallet/add', userProfile, requireActiveUser, walletNewView)

router.post('/profile/wallet/add/data', userProfile, requireActiveUser, walletAddNew)

//referral

router.get('/profile/referral', userProfile, requireActiveUser,referral)

// password 

router.get('/profile/newPassword', userProfile, requireActiveUser, newPassword)

router.put('/password', userProfile, requireActiveUser, setNewPass)

export default router 