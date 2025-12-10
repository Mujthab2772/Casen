import { uploadToCloudinary } from "../../util/cloudinaryUpload.js";
import userCollection from "../../models/userModel.js";
import { generateOtp } from "../../util/generateOtp.js";
import otpCollection from "../../models/otpModel.js";
import { sendOtpEmail } from "../../util/sendOtp.js";
import { comparePassword, hashPassword } from "../../util/hashPassword.js";

export const profileUpdate = async (profileDetails, image, user, req) => {
    try {
        const { firstName, lastName, email, phoneNumber } = profileDetails
        const userDetail = await userCollection.findById({_id: user._id})

        let imageUrl = null
        if(image) {
            imageUrl = await uploadToCloudinary(image.path, "profile-photo")
        }else {
            imageUrl = userDetail.profilePic
        }

        if (userDetail.email !== email) {
            const otp = generateOtp()
            const otpExpiresAt = Date.now() + 2 * 60 * 1000

            await otpCollection.deleteMany({email})

            const newData = new otpCollection({
                email,
                firstName,
                lastName,
                phoneNumber,
                password: userDetail.password,
                profilePic: imageUrl,
                otp,
                otpExpiresAt
            })

            await newData.save()

            await sendOtpEmail(email, otp)

            req.session.pendingEmailChange = {
                oldEmail: userDetail.email,
                newEmail: email
            };

            return 'email changing'
        }

        

        if(!userDetail) return 'User not found'

        userDetail.firstName = firstName || userDetail.firstName
        userDetail.lastName = lastName || userDetail.lastName
        userDetail.email = email || userDetail.email
        userDetail.profilePic = (imageUrl) ? imageUrl : userDetail.profilePic
        userDetail.phoneNumber = phoneNumber || userDetail.phoneNumber

        await userDetail.save()
        return userDetail
        
    } catch (error) {
        console.log(`error from profileUpdate ${error}`);
        throw error
    }
}

// New function for email change verification only
export const verifyEmailChangeOTP = async (email, otp) => {
  try {
    const otpRecord = await otpCollection.findOne({ email: email.newEmail });
    
    if (!otpRecord) return { success: false, message: 'OTP record not found' };
    if (otpRecord.otp !== otp) return { success: false, message: 'Invalid OTP' };
    if (otpRecord.otpExpiresAt < Date.now()) {
      await otpCollection.deleteOne({ email: email.newEmail });
      return { success: false, message: 'OTP expired' };
    }
    
    // Update only the user's email and related fields
    const updatedUser = await userCollection.findOneAndUpdate(
      {email: email.oldEmail}, // Store userId in OTP record during profileUpdate
      { 
        email: otpRecord.email,
        firstName: otpRecord.firstName,
        lastName: otpRecord.lastName,
        phoneNumber: otpRecord.phoneNumber,
        profilePic: otpRecord.profilePic,
        authProvider: "local" 
      },
      { new: true }
    );
    
    await otpCollection.deleteOne({ email: email.newEmail });
    return { success: true };
  } catch (error) {
    console.error('Email change OTP verification error:', error);
    throw error;
  }
};

export const setPassword = async (currentPassword, newPassword, userId) => {
  try {
    const user = await userCollection.findOne({ userId });
    if (!user) {
      return { error: 'User not found.' };
    }

    if (user.password) {
      const isMatch = await comparePassword(currentPassword, user.password);
      if (!isMatch) {
        return { error: 'Current password is incorrect.' };
      }

      const isSame = await comparePassword(newPassword, user.password);
      if (isSame) {
        return { error: 'New password must be different from current password.' };
      }
    }

    const hashedPassword = await hashPassword(newPassword);
    user.password = hashedPassword;
    await user.save();

    return { success: true };
  } catch (error) {
    console.error('Error in setPassword:', error);
    throw error;
  }
};