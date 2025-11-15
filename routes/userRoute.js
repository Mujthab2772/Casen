import express from "express"
import { otpPage, otpPagePost, resendOtp, signUpPageGet, signUpPost } from "../controllers/user/signupController.js"
import { resetPasswordValidate, validateSignUp } from "../middlewares/validationMiddleware.js"
import { googleAuth, googleAuthCallback } from "../controllers/user/googleAuthController.js"
import { forgotOtpPage, forgotOtpVerify, forgotPass, forgotPassResetPost, login, loginGet, resendforgotOtp, resetPassword, resetPasswordVerify } from "../controllers/user/loginController.js"

const router = express.Router()

router.get('/signUpPage', signUpPageGet)

router.post('/signup',validateSignUp, signUpPost)

router.get('/signUpOtp', otpPage)

router.post('/otpverify', otpPagePost)

router.post('/resendOtp', resendOtp)

router.get('/auth/google', googleAuth)

router.get('/auth/google/callback', googleAuthCallback)

router.get('/loginPage', loginGet)

router.post('/login', login)

router.get('/forgotPasswordPage', forgotPass)

router.post('/forgotPassword', forgotPassResetPost)

router.get("/forgotOtp", forgotOtpPage)

router.post('/forgotOtpVerify', forgotOtpVerify)

router.post('/resendForgotOtp', resendforgotOtp)

router.get('/resetPasswordPage', resetPassword)

router.post('/resetPassword', resetPasswordValidate, resetPasswordVerify)

export default router