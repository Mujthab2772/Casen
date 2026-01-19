import otpCollection from "../../models/otpModel.js";
import userCollection from "../../models/userModel.js";
import { Wallet } from "../../models/walletModel.js";
import { Transaction } from "../../models/transactionsModel.js";
import { generateOtp } from "../../util/generateOtp.js";
import { hashPassword } from "../../util/hashPassword.js";
import { sendOtpEmail } from "../../util/sendOtp.js";
import mongoose from 'mongoose';
import logger from '../../util/logger.js'; // ✅ Add logger import

const processReferralBonus = async (referralCode, newUserId) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const referrer = await userCollection.findOne(
            { referralCode, isActive: true, isVerified: true },
            null,
            { session }
        );

        if (!referrer) {
            await session.abortTransaction();
            return;
        }

        let referrerWallet = await Wallet.findOne({ userId: referrer._id }).session(session);
        if (!referrerWallet) {
            referrerWallet = new Wallet({
                userId: referrer._id,
                balance: { amount: new mongoose.Types.Decimal128("0.00"), currency: 'INR' }
            });
            await referrerWallet.save({ session });
        }

        const referrerBonus = new mongoose.Types.Decimal128("20.00");
        const currentReferrerBalance = referrerWallet.balance.amount || new mongoose.Types.Decimal128("0.00");
        const newReferrerBalance = new mongoose.Types.Decimal128(
            (parseFloat(currentReferrerBalance.toString()) + 20).toFixed(2)
        );

        await Wallet.findByIdAndUpdate(referrerWallet._id, {
            'balance.amount': newReferrerBalance
        }, { session });

        await new Transaction({
            wallet: referrerWallet._id,
            amount: referrerBonus,
            currency: 'INR',
            type: 'topup',
            status: 'completed',
            description: `Referral bonus for new signup: ${newUserId}`,
            reference: { orderId: `REF-${Date.now()}` }
        }).save({ session });

        let newWallet = await Wallet.findOne({ userId: newUserId }).session(session);
        if (!newWallet) {
            newWallet = new Wallet({
                userId: newUserId,
                balance: { amount: new mongoose.Types.Decimal128("0.00"), currency: 'INR' }
            });
            await newWallet.save({ session });
        }

        const newUserBonus = new mongoose.Types.Decimal128("10.00");
        const currentNewUserBalance = newWallet.balance.amount || new mongoose.Types.Decimal128("0.00");
        const newUserBalance = new mongoose.Types.Decimal128(
            (parseFloat(currentNewUserBalance.toString()) + 10).toFixed(2)
        );

        await Wallet.findByIdAndUpdate(newWallet._id, {
            'balance.amount': newUserBalance
        }, { session });

        await new Transaction({
            wallet: newWallet._id,
            amount: newUserBonus,
            currency: 'INR',
            type: 'topup',
            status: 'completed',
            description: `Referral bonus from ${referrer.email}`,
            reference: { orderId: `REF-${Date.now()}` }
        }).save({ session });

        await session.commitTransaction();
        
    } catch (error) {
        await session.abortTransaction();
        throw new Error(`Referral processing failed: ${error.message}`);
    } finally {
        session.endSession();
    }
};

export const signupVerify = async (userData) => {
    try {
        const { firstName, lastName, password, confirmPassword, email, phone, referral } = userData;
        
        const existingUser = await userCollection.findOne({ email });
        if (existingUser) return { status: "Email already exists" };
        
        if (password !== confirmPassword) {
            return { status: "confirm password does not match password" };
        }
        
        const hashedPassword = await hashPassword(password);
        const otp = generateOtp();
        const otpExpiresAt = Date.now() + 2 * 60 * 1000;
        
        await otpCollection.deleteMany({ email });
        
        const newOtp = new otpCollection({
            email,
            firstName,
            lastName,
            phoneNumber: phone,
            password: hashedPassword,
            otp,
            otpExpiresAt,
            referralCode: referral?.trim() || null
        });
        
        await newOtp.save();
        await sendOtpEmail(email, otp);
        
        return { status: "success", email };
        
    } catch (error) {
        throw error;
    }
};

export const otpverify = async (email, otp) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const otpRecord = await otpCollection.findOne({ email }).session(session);
        if (!otpRecord) return { status: "Not Found" };
        
        if (otpRecord.otp !== otp) return { status: "Invalid OTP" };
        if (otpRecord.otpExpiresAt < Date.now()) {
            await otpCollection.deleteOne({ email }).session(session);
            return { status: "OTP expired" };
        }
        
        const newUser = new userCollection({
            firstName: otpRecord.firstName,
            lastName: otpRecord.lastName,
            email: otpRecord.email,
            phoneNumber: otpRecord.phoneNumber,
            password: otpRecord.password,
            isVerified: true,
        });
        
        await newUser.save({ session });
        
        const newWallet = new Wallet({
            userId: newUser._id,
            balance: { amount: new mongoose.Types.Decimal128("0.00"), currency: 'INR' }
        });
        
        await newWallet.save({ session });
        
        await otpCollection.deleteOne({ email }).session(session);
        
        await session.commitTransaction();
        
        if (otpRecord.referralCode) {
            try {
                await processReferralBonus(
                    otpRecord.referralCode.trim(),
                    newUser._id
                );
            } catch (referralError) {
                logger.warn(`Referral processing failed but signup continues: ${referralError.message}`);
            }
        }
        
        return { status: "success", user: newUser };
        
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

export const resendingOtp = async (email) => {
    try {
        const otpRecord = await otpCollection.findOne({ email });
        if (!otpRecord) return { status: "User Not Found" };
        
        const newOtp = generateOtp();
        const otpExpiresAt = Date.now() + 2 * 60 * 1000;
        
        otpRecord.otp = newOtp;
        otpRecord.otpExpiresAt = otpExpiresAt;
        await otpRecord.save();
        
        await sendOtpEmail(email, newOtp);
        return { status: "success", email };
        
    } catch (error) {
        throw error;
    }
};