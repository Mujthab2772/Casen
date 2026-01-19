import { walletAdd, walletDetails } from "../../service/user/walletService.js";
import { STATUS_CODE } from "../../util/statusCodes.js";
import logger from '../../util/logger.js'; // ✅ Add logger import

export const wallet = async (req, res) => {
    try {
        const user = req.session.userDetail;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 3;

        const result = await walletDetails(user._id, page, limit);
        return res.render('wallet', { 
            user, 
            wallet: result.wallet, 
            transaction: result.transaction,
            pagination: result.pagination
        });
    } catch (error) {
        logger.error(`Error from wallet: ${error.message}`);
        return res.redirect('/profile');
    }
};

export const walletNewView = async (req, res) => {
    try {
        const user = req.session.userDetail;
        return res.render('walletAdd', { user });
    } catch (error) {
        logger.error(`Error from walletNewView: ${error.message}`);
        return res.redirect('/profile/wallet');
    }
};

export const walletAddNew = async (req, res) => {
    try {
        const userid = req.session.userDetail?._id;
        const result = await walletAdd(userid, req.body);
        return res.status(STATUS_CODE.CREATED).json({ success: result });
    } catch (error) {
        logger.error(`Error from walletAddNew: ${error.message}`);
        // Note: `result` is not defined in catch block — fixed below
        return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ success: false });
    }
};