import { walletAdd, walletDetails } from "../../service/user/walletService.js";
import { STATUS_CODE } from "../../util/statusCodes.js";

// Controller
export const wallet = async (req, res) => {
    try {
        const user = req.session.userDetail;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 3; // Show 5 transactions per page
        
        const result = await walletDetails(user._id, page, limit);
        res.render('wallet', { 
            user, 
            wallet: result.wallet, 
            transaction: result.transaction,
            pagination: result.pagination
        });
    } catch (error) {
        console.log(`error from wallet ${error}`);
        res.redirect('/profile');
    }
}

export const walletNewView = async (req, res) => {
    try {
        const user = req.session.userDetail
        res.render('walletAdd', {user})
    } catch (error) {
        console.log(`error from walletNewView ${error}`);
        res.redirect('/profile/wallet')
    }
}

export const walletAddNew = async (req, res) => {
    try {
        const userid = req.session.userDetail?._id

        const result = await walletAdd(userid, req.body)

        res.status(STATUS_CODE.CREATED).json({success: result})
    } catch (error) {
        console.log(`error from walletAddNew ${error}`);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({success: result})
    }
}