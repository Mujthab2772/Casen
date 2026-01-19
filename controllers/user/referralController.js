import { referralCode } from "../../service/user/referralService.js";
import logger from '../../util/logger.js'; // ✅ Add logger import

export const referral = async (req, res) => {
    try {
        const user = req.session.userDetail;
        const result = await referralCode(user._id, user.firstName);
        return res.render('referral', { user, referral: result });
    } catch (error) {
        logger.error(`Error from referral: ${error.message}`);
        return res.redirect('/profile');
    }
};