import { addressDetails } from "../../service/user/addressService.js"
import { cartDetails } from "../../service/user/cartService.js"
import { tempOrder } from "../../service/user/checkoutService.js"
import { STATUS_CODE } from "../../util/statusCodes.js"

export const checkout = async (req, res) => {
    try {
        const user = req.session.userDetail
        const userId = req.session.userDetail._id

        const cartProducts = await cartDetails(userId)
        const userAddresses = await addressDetails(userId)
        

        return res.render('checkout', {user, cartProducts, userAddresses})
    } catch (error) {
        console.log(`error from checkout ${error}`);
        return res.redirect('/cart')
    }
}

export const checkoutDatas = async (req, res) => {
  try {
    const userId = req.session.userDetail._id;

    // Only accept minimal contact & address info
    const { contact, shippingAddressId } = req.body;

    // 🔁 Re-validate and re-calculate the cart from DB (critical!)
    const recalculated = await tempOrder(userId, { shippingAddressId, contact });

    // If no valid items remain, abort
    if (!recalculated.productList || recalculated.productList.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Your cart contains invalid or out-of-stock items. Please update your cart."
      });
    }

    // Store validated data in session
    req.session.checkout = {
      contact,
      shippingAddressId
    };
    req.session.items = recalculated.productList;
    req.session.address = recalculated.addressDetails;

    req.session.isCheckout = true

    return res.status(STATUS_CODE.OK).json({ success: true });

  } catch (error) {
    console.error(`Error in checkoutDatas:`, error);
    return res.status(500).json({
      success: false,
      message: "Unable to process checkout. Please try again."
    });
  }
};