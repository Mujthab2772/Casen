import user from "../../models/userModel.js";
import logger from '../../util/logger.js'; // ✅ Add logger import

export const referralCode = async (userId, userName) => {
    try {
        const userData = await user.findOne({ _id: userId });
        if (!userData.referralCode) {
            userData.referralCode = generateReferralCode(userName);

            await userData.save();
            return userData.referralCode;
        }
        return userData.referralCode;
    } catch (error) {
        logger.error(`Error from referralCode: ${error.message}`);
        throw error;
    }
};

function generateReferralCode(firstName = 'USER', length = 4) {
  const base = firstName.trim().substring(0, 6).toUpperCase();
  
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < length; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return (base + suffix.trim());
}