import express from "express"
import { otpPage, otpPagePost, resendOtp, signUpPageGet, signUpPost } from "../controllers/user/signupController.js"

const router = express.Router()

router.get('/signUpPage', signUpPageGet)

router.post('/signup',signUpPost)

router.get('/signUpOtp', otpPage)

router.post('/otpverify', otpPagePost)

router.post('/resendOtp', resendOtp)

export default router