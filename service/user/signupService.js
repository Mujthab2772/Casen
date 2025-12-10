import otpCollection from "../../models/otpModel.js";
import userCollection from "../../models/userModel.js";
import { generateOtp } from "../../util/generateOtp.js";
import { hashPassword } from "../../util/hashPassword.js";
import { sendOtpEmail } from "../../util/sendOtp.js";
import { v4 as uuidv4 } from "uuid";


export const signupVerify = async (userData) => {
    try {
        const {firstName, lastName, password, confirmPassword, email, phone} = userData

        const existingUser = await userCollection.findOne({email});

        if (existingUser) {
            if (existingUser.email === email) {
                return { status: "Email already exists" };
            }
        }

        if (password !== confirmPassword) {
            return {status: "confirm password does not match password"}
        }

        const hashedPassword = await hashPassword(password)
        const otp = generateOtp()
        const otpExpiresAt = Date.now() + 2 * 60 * 1000

        await otpCollection.deleteMany({email})

        const newOtp = new otpCollection({
            email,
            firstName,
            lastName,
            phoneNumber: phone,
            password: hashedPassword,
            otp,
            otpExpiresAt
        })

        await newOtp.save()

        await sendOtpEmail(email, otp)

        return {status: "success", email}

    } catch (error) {
        console.log(`error from signupverify ${error}`);  
        throw error      
    }
}

export const otpverify = async (email, otp) => {
    try {
        let otpRecord = await otpCollection.findOne({email})       

        if(!otpRecord) {
            return {status: "Not Found"}
        }

        if (otpRecord.otp != otp) {
            return {status: "Invalid OTP"}
        }

        if(otpRecord.otpExpiresAt < Date.now()) {
            await otpCollection.deleteOne({email})
            return {status: "OTP expired"}
        }

        const newUser = new userCollection({
            userId: uuidv4(),
            firstName: otpRecord.firstName,
            lastName: otpRecord.lastName,
            email: otpRecord.email,
            phoneNumber: otpRecord.phoneNumber,
            password: otpRecord.password,
            isVerified: true,
        }); 
        await newUser.save()

        await otpCollection.deleteOne({email})

        return {status: "success", user}
    } catch (error) {
        console.log(`error from otpverify ${error}`);      
        throw error  
    }
}

export const resendingOtp = async (email) => {
    try {
        let userExist = await otpCollection.findOne({email})

        if(!userExist) {
            return {status: "User Not Found"}
        }

        const newOtp = generateOtp()
        const otpExpiresAt = Date.now() + 2 * 60 * 1000

        userExist.otp = newOtp
        userExist.otpExpiresAt = otpExpiresAt

        await userExist.save()

        await sendOtpEmail(email, newOtp)

        
        return {status: "success", email}
        
    } catch (error) {
        console.log(`error from resendOtp ${error}`);
        throw error
    }
}