import express from "express"
import { otpPage, otpPagePost, resendOtp, signUpPageGet, signUpPost } from "../controllers/user/signupController.js"
import { validateSignUp } from "../middlewares/validationMiddleware.js"
import { googleAuth, googleAuthCallback } from "../controllers/user/googleAuthController.js"
import { loginGet } from "../controllers/user/loginController.js"

const router = express.Router()

router.get('/signUpPage', signUpPageGet)

router.post('/signup',validateSignUp, signUpPost)

router.get('/signUpOtp', otpPage)

router.post('/otpverify', otpPagePost)

router.post('/resendOtp', resendOtp)

router.get('/auth/google', googleAuth)

router.get('/auth/google/callback', googleAuthCallback)

router.get('/loginPage', loginGet)

export default router