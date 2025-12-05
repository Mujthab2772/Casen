import { tempOrder } from "../../service/user/checkoutService.js";
import { cashOnDelivery, orderCalculation, orderDetails } from "../../service/user/paymentService.js";

export const payment = async (req, res) => {
  try {
    const user = req.session.userDetail;
    if (!user) {
      return res.redirect('/');
    }

    const userId = user._id;

    // 🔁 Re-validate the cart and re-calculate order summary
    // (This is the same logic you use in checkoutDatas)
    const recalculated = await tempOrder(userId, req.session.checkout);

    const checkoutDetail = await orderCalculation(recalculated, req)

    // console.log(req.session.items);
    // console.log(req.session.address);
    
    req.session.checkout = checkoutDetail

    return res.render('payment', { user, checkoutDetail });

  } catch (error) {
    console.error(`Error in payment controller:`, error);
    // Clear potentially stale session data
    delete req.session.checkout;
    delete req.session.items;
    delete req.session.address;
    return res.redirect('/checkout');
  }
};

export const paymentProcess = async (req, res) => {
    try {
        let result = null
        if(req.body.paymentMethod == 'cash') {
            result = await cashOnDelivery(req)
        }

        req.session.isCheckout = false
        return res.redirect(`/payment/success?orderId=${result.orderId}`)
    } catch (error) {
        console.log(`error form paymentProcess ${error}`);
        return res.redirect('/payment')
    }
}

export const paymentSuccess = async (req, res) => {
    try {
        const user = req.session.userDetail

        const result = await orderDetails(user._id, req.query.orderId)

        res.render('paymentSucces', {user, order: result})
    } catch (error) {
        console.log(`error from paymentSuccess ${error}`);
        res.redirect('/payment')
    }
}