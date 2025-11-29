import express from "express"
import { otpPage, otpPagePost, resendOtp, signUpPageGet, signUpPost } from "../controllers/user/signupController.js"
import { resetPasswordValidate, validateSignUp } from "../middlewares/validationMiddleware.js"
import { googleAuth, googleAuthCallback } from "../controllers/user/googleAuthController.js"
import { forgotOtpPage, forgotOtpVerify, forgotPass, forgotPassResetPost, login, loginGet, resendforgotOtp, resetPassword, resetPasswordVerify } from "../controllers/user/loginController.js"
import { landingPage, logout } from "../controllers/user/landingPage.js"
import { fetchProducts, singleProduct } from "../controllers/user/productsController.js"
import { preventAuthAccess, requireActiveUser, userProfile } from "../middlewares/userMiddleware.js"
import { editProfile, ProfileUser, updateProfile } from "../controllers/user/profileController.js"
import upload from "../middlewares/multer.js"
import { address, addressEdit, addressEditUpdate, addressFetch, addressNew, deleteAddress } from "../controllers/user/addressController.js"
import { validateAddress } from "../middlewares/addressMiddleware.js"


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

router.get('/',requireActiveUser, landingPage)

router.get('/products',requireActiveUser, fetchProducts)

router.get('/product',requireActiveUser, singleProduct)

router.post('/logout', logout)

// user Profile

router.get('/profile', userProfile, ProfileUser)

router.get('/profile/edit', userProfile, editProfile)

router.put('/profile/edit', userProfile, upload.single("profilePic"), updateProfile)

//address

router.get('/profile/address', userProfile, address)

router.get('/profile/newAddress', userProfile, addressFetch)

router.post('/profile/addAddress', userProfile, validateAddress, addressNew)

router.get('/profile/editAddress', userProfile, addressEdit)

router.put('/profile/editAddress/update', userProfile, validateAddress, addressEditUpdate)

router.delete('/profile/deleteAddress', userProfile, deleteAddress)


export default router