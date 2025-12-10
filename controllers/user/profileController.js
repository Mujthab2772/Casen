// Updated profile controller file
import address from "../../models/addressModel.js";
import user from "../../models/userModel.js";
import { profileUpdate, setPassword, verifyEmailChangeOTP } from "../../service/user/profileService.js";
import { resendingOtp } from "../../service/user/signupService.js";
import { STATUS_CODE } from "../../util/statusCodes.js";
import { validatePassword } from "../../util/validation.js";

export const ProfileUser = async (req, res) => {
    try {
        const user = req.session.userDetail;
        const defaultAddress = await address.findOne({userId: user._id, isDefault: true})
        const successMessage = req.session.successMessage || null;
        // Clear the message after retrieving it to prevent showing on refresh
        req.session.successMessage = null; 
        return res.render('profile', { user, successMessage, defaultAddress });
    } catch (error) {
        console.log(`error from profileUser ${error}`);
        return res.redirect('/')
    }
}

export const editProfile = (req, res) => {
    try {
        const user = req.session.userDetail
        return res.render('editProfile', {user})
    } catch (error) {
        console.log(`error from editProfile ${error}`);
        return res.redirect('/profile')
    }
}

export const updateProfile = async (req, res) => {
  try {
    const user = req.session.userDetail;
    const result = await profileUpdate(req.validatedData, req.file, user, req);
    if(result === 'email changing') {
      return res.json({ success: true, redirect: '/profile/email/otp' });
    }
    if (result === 'User not found') {
      return res.json({ success: false, message: 'User not found' });
    }
    req.session.userDetail = result;
    return res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.log(`error from updateProfile ${error}`);
    return res.json({ success: false, message: 'An unexpected error occurred' });
  }
};

export const verifyEmail = (req, res) => {
  try {
    res.status(STATUS_CODE.OK).render('otpVerificationPage', { otpErr: req.session.otpInvalid, path: 'emailVerify' })
  } catch (error) {
    console.log(`error from verifyEmail ${error}`);
    res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/profile')
  }
}

export const otpVerify = async (req, res) => {
  try {
    const email = req.session.pendingEmailChange;
    const { box1, box2, box3, box4, box5, box6 } = req.body;
    const otp = `${box1}${box2}${box3}${box4}${box5}${box6}`;
    req.session.otpInvalid = null
    const result = await verifyEmailChangeOTP(email, otp);
    if (result.success) {
      req.session.otpInvalid = null
      const updatedUser = await user.findById(req.session.userDetail._id);
      req.session.userDetail = updatedUser;
      req.session.pendingEmailChange = null;
      req.session.successMessage = 'Your email has been successfully updated!';
      return res.redirect('/profile')
    }
    req.session.otpInvalid = result.message;
    return res.redirect('/profile/email/otp');
  } catch (error) {
    console.error('OTP verification error:', error);
    req.session.otpInvalid = 'Server error. Please try again.';
    return res.redirect('/profile/email/otp');
  }
};

export const otpResend = async (req, res) => {
  try {
    req.session.otpInvalid = null
    const result = await resendingOtp(req.session.pendingEmailChange.newEmail)
    if(result.status === "User Not Found") {
      req.session.otpInvalid = "User not found"
      return res.json({success: false, redirectUrl: '/profile/email/otp'})
    }
    return res.json({success: true, redirectUrl: '/profile/email/otp'})
  } catch (error) {
    console.log(`errro from otpResend ${error}`);
    return res.redirect('/profile')
  }
}

export const newPassword = (req, res) => {
  try {
    const user = req.session.userDetail
    const errorMessage = req.session.errorMessage || null
    const successMessage = req.session.successMessage || null
    req.session.errorMessage = null
    req.session.successMessage = null

    return res.render('profilePassword', {user, errorMessage, successMessage})
  } catch (error) {
    console.log(`error from newPassword ${error}`);
    res.redirect('/profile')
  }
}

export const setNewPass = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.session.userDetail?.userId;

    if (!userId) {
      return res.redirect('/login');
    }

    const validtePass = validatePassword(newPassword)
    if(!validtePass) {
      req.session.errorMessage = 'Password is not valid'
      return res.redirect('/profile/newPassword')
    }

    // Frontend should validate, but double-check
    if (newPassword !== confirmPassword) {
      req.session.errorMessage = 'New passwords do not match.'
      return res.redirect('/profile/newPassword')
    }

    const result = await setPassword(currentPassword, newPassword, userId);

    if (result.error) {
      req.session.errorMessage = result.error
      return res.redirect('/profile/newPassword')
    }

    // Success → render with success message (or redirect + flash)
    req.session.successMessage = 'Password updated successfully!'
    res.redirect('/profile/newPassword')

  } catch (error) {
    console.error('Error in setNewPass:', error);
    req.session.errorMessage = 'An unexpected error occurred.'
    res.redirect('/profile/newPassword')
  } 
};