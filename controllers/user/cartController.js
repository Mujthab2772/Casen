import { cartDetails, cartNew, cartRemove, cartUpdate } from "../../service/user/cartService.js";
import { STATUS_CODE } from "../../util/statusCodes.js";

export const cart = async (req, res) => {
    try {
        const user = req.session.userDetail
        const result = await cartDetails(user._id)
        res.render('cart', {user, cart:result})
    } catch (error) {
        console.log(`error from cart`);
        res.redirect('/')
    }
}


export const newCart = async (req, res) => {
    try {
        const userId = req.session.userDetail._id
        const result = await cartNew(req.body, userId)

        if(result === 'Maximum limit reached in cart') {
            return res.status(STATUS_CODE.BAD_REQUEST).json({success: 'fail'})
        }

        return res.status(STATUS_CODE.OK).json({success: 'success'})
    } catch (error) {
        console.log(`error from newCart ${error}`);
        res.redirect('/')
    }
}

export const updateCart = async (req, res) => {
    try {
        const user = req.session.userDetail._id
        const result = await cartUpdate(user, req.body)

        return res.json({success: result.success})
    } catch (error) {
        console.log(`error from updateCart ${error}`);
        return res.redirect('/cart')
    }
}

export const removeCart = async (req, res) => {
    try {
        const userId = req.session.userDetail._id
        const result = await cartRemove(req.body, userId)

        return res.json({success: result.success})
    } catch (error) {
        console.log(`error from remveCart ${error}`);
        return res.redirect('/cart')
    }
}