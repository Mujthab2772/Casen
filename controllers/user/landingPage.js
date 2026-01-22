import { productDetailsFilter, userDetail } from "../../service/user/landingpageService.js";
import logger from '../../util/logger.js'; // ✅ Add logger import

export const landingPage = async (req, res) => {
    try {
        const result = await productDetailsFilter();
        const email = req.session.userEmail;
        let user = null;
        if (email) {
            user = await userDetail(email);
            req.session.userDetail = user;
        }

        return res.render('landingPage', { products: result, user });
    } catch (error) {
        logger.error(`Error from landingPage: ${error.message}`);
        // Optional: send a fallback response if needed
        return res.status(500).send('Internal Server Error');
    }
}

export const logout = async (req, res) => {
    try {
        req.session.destroy(err => {
            if (err) {
                logger.error(`Error during user logout: ${err.message}`);
                return res.send("Error Logging out");
            }
            res.clearCookie("connect.sid");
            res.redirect('/');
        });
    } catch (error) {
        logger.error(`Error from logout user: ${error.message}`);
        // Re-throw or handle as needed; currently just logs
        res.redirect('/'); // optional fallback
    }
}

export const aboutSection = async (req, res) => {
    try {
        const user = req.session.userDetail
        res.render('about', {user})
    } catch (error) {
        logger.error(`error from aboutSection ${err}`)
    }
}