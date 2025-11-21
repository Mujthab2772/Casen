import express from "express"
import { otpPage, otpPagePost, resendOtp, signUpPageGet, signUpPost } from "../controllers/user/signupController.js"
import { resetPasswordValidate, validateSignUp } from "../middlewares/validationMiddleware.js"
import { googleAuth, googleAuthCallback } from "../controllers/user/googleAuthController.js"
import { forgotOtpPage, forgotOtpVerify, forgotPass, forgotPassResetPost, login, loginGet, resendforgotOtp, resetPassword, resetPasswordVerify } from "../controllers/user/loginController.js"
import { landingPage, logout } from "../controllers/user/landingPage.js"
import { fetchProducts, singleProduct } from "../controllers/user/productsController.js"
import { preventAuthAccess, requireUserNotAdmin } from "../middlewares/userMiddleware.js"


const router = express.Router()

router.get('/signUpPage',preventAuthAccess, signUpPageGet)

router.post('/signup', preventAuthAccess,validateSignUp, signUpPost)

router.get('/signUpOtp',preventAuthAccess, otpPage)

router.post('/otpverify',preventAuthAccess, otpPagePost)

router.post('/resendOtp',preventAuthAccess, resendOtp)

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

router.get('/',requireUserNotAdmin, landingPage)

router.get('/products',requireUserNotAdmin, fetchProducts)

router.get('/product',requireUserNotAdmin, singleProduct)

router.post('/logout', logout)

// router.get('/Home',requireAuth, homePage)

export default router