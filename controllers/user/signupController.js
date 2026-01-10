import { otpverify, resendingOtp, signupVerify } from "../../service/user/signupService.js";
import { STATUS_CODE } from "../../util/statusCodes.js";

export const signUpPageGet = (req, res) => {
    try {
        res.render('signupPage', {
            errorFirstName: req.session.signUpErrFn,
            errorLastName: req.session.signUpErrLn,
            errorEmail: req.session.signUpErrEmail,
            errorPass: req.session.signUpErrPass,
            errorPhone: req.session.signUpErrPhone,
            errorConfirm: req.session.signUpErrPassConfirm,
            errorReferral: req.session.signUpErrReferral
        });
    } catch (error) {
        console.error(`signUpPageGet failed: ${error.message}`);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/');
    }
}

export const signUpPost = async (req, res) => {
    try {
        const { firstName, lastName, email, phone, password, confirmPassword, referral } = req.body;
        
        if (referral && referral.length > 20) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({
                success: false,
                error: "Referral code too long"
            });
        }

        const result = await signupVerify({
            firstName,
            lastName,
            email,
            phone,
            password,
            confirmPassword,
            referral: referral?.trim() || null
        });

        if (result.status === "Email already exists") {
            return res.status(STATUS_CODE.CONFLICT).json({
                success: false,
                error: "Email already exists"
            });
        }

        if (result.status === "confirm password does not match password") {
            return res.status(STATUS_CODE.BAD_REQUEST).json({
                success: false,
                error: "Passwords do not match"
            });
        }

        req.session.tempEmail = result.email;
        return res.status(STATUS_CODE.CREATED).json({ success: true });

    } catch (error) {
        console.error(`signUpPost failed: ${error.message}`);
        return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: "Internal server error"
        });
    }
};

export const otpPage = (req, res) => {
    try {
        res.status(STATUS_CODE.OK).render('otpVerificationPage', {
            otpErr: req.session.otpInvalid, 
            path: "signupVerify"
        });
    } catch (error) {
        console.error(`otpPage failed: ${error.message}`);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/signUpPage');
    }
}

export const otpPagePost = async (req, res) => {
    try {
        const email = req.session.tempEmail;
        req.session.otpInvalid = "";
        const { box1, box2, box3, box4, box5, box6 } = req.body;
        const otp = `${box1}${box2}${box3}${box4}${box5}${box6}`;
        let result = await otpverify(email, otp);

        if (result.status === "Not Found") {
            req.session.otpInvalid = "Not Found";
            return res.status(STATUS_CODE.BAD_REQUEST).redirect('/signUpOtp');
        } else if (result.status === "Invalid OTP") {
            req.session.otpInvalid = "Invalid OTP";
            return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/signUpOtp');
        } else if (result.status === "OTP expired") {
            req.session.otpInvalid = "OTP expired";
            return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/signUpOtp');
        }

        req.session.isAuthenticated = true;
        req.session.userEmail = email;
        return res.status(STATUS_CODE.OK).redirect('/');

    } catch (error) {
        console.error(`otpPagePost failed: ${error.message}`);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/signUpOtp');
    }
}

export const resendOtp = async (req, res) => {
    try {
        req.session.otpInvalid = null;
        let result = await resendingOtp(req.session.tempEmail);

        if (result.status === "User Not Found") {
            req.session.otpInvalid = "User Not Found";
            return res.json({ success: true, redirectUrl: '/signUpOtp' });
        }
        return res.json({ success: true, redirectUrl: '/signUpOtp' });
    } catch (error) {
        console.error(`resendOtp failed: ${error.message}`);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/signUpOtp');
    }
}