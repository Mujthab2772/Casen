import { otpverify, resendingOtp, signupVerify } from "../../service/user/signupService.js";
import { STATUS_CODE } from "../../util/statusCodes.js";

export const signUpPageGet = (req, res) => {
    try {
        res.render('signupPage', {errorFirstName: req.session.signUpErrFn, errorLastName: req.session.signUpErrLn, errorEmail: req.session.signUpErrEmail, errorPass: req.session.signUpErrPass, errorPhone: req.session.signUpErrPhone, errorConfirm: req.session.signUpErrPassConfirm})
    } catch (error) {
        console.log(`error from signupPageGet ${error}`);
    }
}


export const signUpPost = async (req, res) => {
    try {
        req.session.signUpErr = null
        req.session.signUpErrPass = null
        req.session.tempEmail = null
        const result = await signupVerify(req.body)

        if (result.status === "Email already exists") {
            req.session.signUpErrEmail = "Email already exists"
            return res.status(STATUS_CODE.BAD_REQUEST).redirect('/signUpPage')
        }

        if (result.status === "confirm password does not match password") {
            req.session.signUpErrPassConfirm = "Passwords do not match"
            return res.status(STATUS_CODE.BAD_REQUEST).redirect('/signUpPage')
        }
        req.session.tempEmail = result.email
        return res.status(STATUS_CODE.OK).redirect('/signUpOtp')


    } catch (error) {
        console.log(`error from signUpPost ${error}`);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/signUpPage')
    }    
}

export const otpPage = (req, res) => {
    try {
        res.status(STATUS_CODE.OK).render('otpVerificationPage', {otpErr: req.session.otpInvalid})
    } catch (error) {
        console.log(`error from otpPage`);   
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/signUpPage')     
    }
}

export const otpPagePost = async (req, res) => {
    try {
        const email = req.session.tempEmail
        req.session.otpInvalid = ""
        const {box1, box2, box3, box4, box5, box6} = req.body
        const otp = ('' + box1 + box2 + box3 + box4 + box5 + box6)

        let result = await otpverify(email, otp)

        if (result.status === "Not Found") {
            req.session.otpInvalid = "Not Found"
            return res.status(STATUS_CODE.BAD_REQUEST).redirect('/signUpOtp')
        }else if (result.status === "Invalid OTP") {
            req.session.otpInvalid = "Invalid OTP"
            return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/signUpOtp')
        }else if(result.status === "OTP expired") {
            req.session.otpInvalid = "OTP expired"
            return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/signUpOtp')
        }

        req.session.isAuthenticated = true
        req.session.userEmail = email

        return res.status(STATUS_CODE.OK).redirect('/')
    } catch (error) {
        console.log(`error from otpPagePost ${error}`);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/signUpOtp')
    }
}

export const resendOtp = async (req, res) => {
    try {
        req.session.otpInvalid = null
        let result = await resendingOtp(req.session.tempEmail)

        if (result.status === "User Not Found") {
            req.session.otpInvalid = "User Not Found"
            return res.json({success: true, redirectUrl: '/signUpOtp'})
        }
        return res.json({success: true, redirectUrl: '/signUpOtp'})
    } catch (error) {
        console.log(`error from resendOtp ${error}`);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/signUpOtp')
    }
}

