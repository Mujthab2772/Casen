import { forgotPassReset, loginValidate, otpVerifyForgot, resetPasswordService } from "../../service/user/loginService.js";
import { resendingOtp } from "../../service/user/signupService.js";
import { STATUS_CODE } from "../../util/statusCodes.js";

export const loginGet = (req, res) => {
  try {
    let { loginErr, loginPassErr } = req.session;
    // Clear immediately to avoid leakage
    req.session.loginErr = null;
    req.session.loginPassErr = null;

    if (req.session.messages?.[0] === "User is blocked") {
      loginErr = "User is blocked";
    }
    req.session.messages = [];

    res.render('loginPage', { loginErr, loginPassErr });
  } catch (error) {
    console.error(`Error in loginGet: ${error}`);
    res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/login');
  }
}

export const login = async (req, res) => {
    try {
        req.session.loginErr = null
        req.session.loginPassErr = null
        const result = await loginValidate(req.body)

        if (result.status === "User Not Found") {
            req.session.loginErr = "Not have account please signUp"
            return res.status(STATUS_CODE.BAD_REQUEST).redirect('/login')
        }

        if (result.status === "Login with Google") {
            req.session.loginErr = 'Login with Google'
            return res.status(STATUS_CODE.OK).redirect('/login')
        }

        if(result.status === "User is Blocked") {
            req.session.loginErr = "Account is Blocked"
            return res.status(STATUS_CODE.OK).redirect('/login')
        }

        if (result.status === "Incorrect Password") {
            req.session.loginPassErr = "Incorrect Password"
            return res.status(STATUS_CODE.BAD_REQUEST).redirect("/login")
        }

        req.session.isAuthenticated = true
        req.session.userEmail = req.body.email

        return res.status(STATUS_CODE.OK).redirect('/')
    } catch (error) {
        console.log(`error from login ${error}`);
        return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect("/login")
    }
}


export const forgotPass = (req, res) => {
    try {
        return res.status(STATUS_CODE.OK).render('forgotPassword', {forgotPassErr: req.session.forgotPassErr})
    } catch (error) {
        console.log(`error from forgotPass ${error}`);
        return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/login')
    }
}

export const forgotPassResetPost = async (req, res) => {
    try {
        req.session.forgotPassErr = null
        let result = await forgotPassReset(req.body)

        if(result.status === "This Email not have account") {
            req.session.forgotPassErr = "This Email not have account"
            return res.status(STATUS_CODE.BAD_REQUEST).redirect('/forgotPassword')    
        }

        if (result.status === "Google User No Password") {
            req.session.forgotPassErr = "You signed up with Google and haven’t set a password yet.Sign with Google and Go to profile and set one first.";
            return res.status(STATUS_CODE.BAD_REQUEST).redirect('/forgotPassword');
        }

        req.session.forgotEmail = result.forgotPassEmail
        return res.status(STATUS_CODE.OK).redirect('/forgotOtp')
    } catch (error) {
        console.log(`error forgotPassResetPost ${error}`);
        return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/forgotPassword')
    }
}

export const forgotOtpPage = async (req, res) => {
    try {
        return res.status(STATUS_CODE.OK).render('otpforgotPassword', {otpErr: req.session.otpInvalid})
    } catch (error) {
        console.log(`error from forgotOtpPage ${error}`);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/forgotOtp')
    }
}

export const forgotOtpVerify = async (req, res) => {
    try {
        const email = req.session.forgotEmail
        req.session.otpInvalid = null

        if (!email) {
            req.session.otpInvalid = "NoEmailInSession";
            return res.status(STATUS_CODE.BAD_REQUEST).redirect('/forgotOtp');
        }

        const result = await otpVerifyForgot(req.body, email)



        if (result.status === "Not Found") {
            req.session.otpInvalid = "Not Found"
            return res.status(STATUS_CODE.BAD_REQUEST).redirect('/forgotOtp')
        }else if (result.status === "Invalid Otp") {
            req.session.otpInvalid = "Invalid OTP"
            return res.status(STATUS_CODE.BAD_REQUEST).redirect('/forgotOtp')
        }else if( result.status === "OTP expired") {
            req.session.otpInvalid = "OTP expired"
            return res.status(STATUS_CODE.BAD_REQUEST).redirect('/forgotOtp')
        }

        return res.status(STATUS_CODE.OK).redirect('/resetPasswordPage')
    } catch (error) {
        console.log(`error from forgotOtpVerify ${error}`);
        req.session.otpInvalid = "Server Error"
        return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/forgotOtp')
    }
}

export const resendforgotOtp = async (req, res) => {
    try {
        req.session.otpInvalid = null
        console.log(req.session.forgotEmail)
        let result = await resendingOtp(req.session.forgotEmail)


        console.log(result)
        if (result.status === "User Not Found") {
            req.session.otpInvalid = "User Not Found"
            return res.json({success: true, redirectUrl: '/forgotOtp'})
        }
        return res.json({success: true, redirectUrl: '/forgotOtp'})
    } catch (error) {
        console.log(`error from resendOtp ${error}`);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/forgotOtp')
    }
}

export const resetPassword = (req, res) => {
    try {
        return res.status(STATUS_CODE.OK).render('resetPassword', {resetErr: req.session.newPassErr, confirmPassErr: null})
    } catch (error) {
        console.log(`error from resetPassword ${error}`);
        res.redirect('/resetPasswordPage')
    }
}

export const resetPasswordVerify = async (req, res) => {
    try {
        const {resetPassword} = req.body
        const result = await resetPasswordService(req.session.forgotEmail, resetPassword)

        if(result.status === "Current Password and new Password cannot be same") {
            req.session.newPassErr = "Current Password and new Password cannot be same"
            return res.status(STATUS_CODE.BAD_REQUEST).redirect('/resetPasswordPage')
        }

        if(result.status === "User not found") {
            return res.status(STATUS_CODE.BAD_REQUEST).redirect('/resetPasswordPage')
        }

        res.status(STATUS_CODE.OK).redirect('/login')
    } catch (error) {
        console.log(`error from resetPasswordVerify ${error}`);
        res.redirect('/resetPasswordPage')
    }
}