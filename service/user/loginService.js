import otpCollection from "../../models/otpModel.js";
import userCollection from "../../models/userModel.js";
import { generateOtp } from "../../util/generateOtp.js";
import { comparePassword, hashPassword } from "../../util/hashPassword.js";
import { sendOtpEmail } from "../../util/sendOtp.js";
import logger from '../../util/logger.js'; // ✅ Add logger import

export const loginValidate = async (loginUser) => {
    try {
        const { email, password } = loginUser;

        const checkUser = await userCollection.findOne({ email });

        if (!checkUser) {
            return { status: "User Not Found" };
        }

        if (checkUser.authProvider === 'google' && !checkUser.password) {
            return { status: "Login with Google" };
        }

        if (!checkUser.isActive) {
            return { status: "User is Blocked" };
        }

        const compare = await comparePassword(password, checkUser.password);

        if (!compare) {
            return { status: "Incorrect Password" };
        }

        return checkUser;
    } catch (error) {
        logger.error(`Error from loginValidate: ${error.message}`);
        throw error;
    }
};

export const forgotPassReset = async (email) => {
    try {
        const { forgotPassEmail } = email;
        const exitsUser = await userCollection.findOne({ email: forgotPassEmail });

        if (!exitsUser) {
            return { status: "This Email not have account" };
        }

        if (exitsUser.authProvider === "google" && !exitsUser.password) {
            return { status: "Google User No Password" };
        }

        const newOtp = generateOtp();
        const otpExpiresAt = Date.now() + 2 * 60 * 1000;

        let otpUser = await otpCollection.findOne({ email: forgotPassEmail });

        if (!otpUser) {
            otpUser = new otpCollection({ email: forgotPassEmail, otp: newOtp });
        } else {
            otpUser.otp = newOtp;
            otpUser.otpExpiresAt = otpExpiresAt;
        }
        await otpUser.save();

        await sendOtpEmail(forgotPassEmail, newOtp);

        return { forgotPassEmail };
    } catch (error) {
        logger.error(`Error from forgotPassReset: ${error.message}`);
        throw error;
    }
};

export const otpVerifyForgot = async (otp, email) => {
    try {
        const { forgotBox1, forgotBox2, forgotBox3, forgotBox4, forgotBox5, forgotBox6 } = otp;
        const newOtp = ('' + forgotBox1 + forgotBox2 + forgotBox3 + forgotBox4 + forgotBox5 + forgotBox6);

        const otpRecord = await otpCollection.findOne({ email });

        if (!otpRecord) {
            return { status: "Not Found" };
        }

        if (otpRecord.otp !== newOtp) {
            return { status: "Invalid Otp" };
        }

        if (otpRecord.otpExpiresAt < Date.now()) {
            await otpCollection.deleteOne({ email });
            return { status: "OTP expired" };
        }

        return { status: "success" };
    } catch (error) {
        logger.error(`Error from otpVerifyForgot: ${error.message}`);
        throw error;
    }
};

export const resetPasswordService = async (email, password) => {
    try {
        const newPassword = await hashPassword(password);

        const resetPasswordUser = await userCollection.findOne({ email });

        if (!resetPasswordUser) {
            return { status: "User not found" };
        }

        if (resetPasswordUser.password) {
            const checkPass = await comparePassword(password, resetPasswordUser.password);
            if (checkPass) {
                return { status: "Current Password and new Password cannot be same" };
            }
        }

        resetPasswordUser.password = newPassword;
        await resetPasswordUser.save();
        return { status: "success" };
    } catch (error) {
        logger.error(`Error from resetPasswordService: ${error.message}`);
        throw error;
    }
};