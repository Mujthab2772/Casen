import { cartDetails, cartNew, cartRemove, cartUpdate, checkInventory } from "../../service/user/cartService.js";
import { STATUS_CODE } from "../../util/statusCodes.js";

export const cart = async (req, res) => {
    try {
        const user = req.session.userDetail;
        const result = await cartDetails(user._id);
        res.render('cart', { user, cart: result });
    } catch (error) {
        console.error(`Error from cart controller: ${error}`);
        res.redirect('/');
    }
};

export const newCart = async (req, res) => {
    try {
        const userId = req.session.userDetail._id;
        const result = await cartNew(req.body, userId);
        
        if (result === 'Maximum limit reached in cart') {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ 
                success: false, 
                message: 'Maximum limit reached in cart' 
            });
        }
        
        if (result === 'Insufficient stock') {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ 
                success: false, 
                message: 'Insufficient stock available' 
            });
        }
        
        return res.status(STATUS_CODE.OK).json({ success: true });
    } catch (error) {
        console.error(`Error from newCart controller: ${error}`);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
};

export const updateCart = async (req, res) => {
    try {
        const user = req.session.userDetail._id;
        const { cartProductId, quantity } = req.body;
        
        if (!cartProductId || !quantity) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ 
                success: false, 
                message: 'Missing required parameters' 
            });
        }
        
        if (quantity < 1 || quantity > 10) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ 
                success: false, 
                message: 'Invalid quantity. Must be between 1 and 10.' 
            });
        }
        
        const result = await cartUpdate(user, req.body);
        
        if (!result.success) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ 
                success: false, 
                message: result.message || 'Failed to update cart item' 
            });
        }
        
        return res.json({ success: true });
    } catch (error) {
        console.error(`Error from updateCart controller: ${error}`);
        return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
};

export const removeCart = async (req, res) => {
    try {
        const userId = req.session.userDetail._id;
        const result = await cartRemove(req.body, userId);
        
        if (!result.success) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ 
                success: false, 
                message: 'Failed to remove cart item' 
            });
        }
        
        return res.json({ success: true });
    } catch (error) {
        console.error(`Error from removeCart controller: ${error}`);
        return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
};

// New inventory check endpoint
export const checkInventoryRoute = async (req, res) => {
    try {
        const { variantId, quantity } = req.body;
        
        if (!variantId || !quantity) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ 
                success: false, 
                message: 'Missing required parameters' 
            });
        }
        
        const inventoryCheck = await checkInventory(variantId, quantity);
        return res.json(inventoryCheck);
    } catch (error) {
        console.error(`Error from inventory check: ${error}`);
        return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
};