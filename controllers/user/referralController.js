import { referralCode } from "../../service/user/referralService.js";

export const referral = async(req, res) => {
    try {
        const user = req.session.userDetail
        const result = await referralCode(user._id, user.firstName)
        res.render('referral', {user, referral: result})
    } catch (error) {
        console.log(`error from  referral ${error}`);
        res.redirect('/profile')
    }
}