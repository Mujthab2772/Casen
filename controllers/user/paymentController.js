import { 
  couponDetails, 
  tempOrder 
} from "../../service/user/checkoutService.js";
import { 
  cashOnDelivery,
  createRazorpayOrderSession,
  verifyRazorpayPayment,
  orderDetails
} from "../../service/user/paymentService.js";


export const payment = async (req, res) => {
  try {
    const user = req.session.userDetail;
    if (!user) {
      req.flash('error', 'You must be logged in to proceed to payment.');
      return res.redirect('/login');
    }
    
    const userId = user._id;
    if (!req.session.checkout) {
      req.flash('error', 'Checkout session expired. Please checkout again.');
      return res.redirect('/checkout');
    }
    
    const { shippingAddressId, contact, appliedCouponCode } = req.session.checkout;
    
    try {
      const recalculated = await tempOrder(userId, {
        shippingAddressId,
        contact
      });
      
      if (!recalculated?.productList?.length) {
        delete req.session.checkout;
        req.flash('error', 'Your cart is empty or contains invalid items.');
        return res.redirect('/cart');
      }
      
      let subtotal = recalculated.productList.reduce((s, i) => s + i.price * i.quantity, 0);
      let discount = 0;
      
      if (appliedCouponCode) {
        const coupon = await couponDetails({ couponCode: appliedCouponCode.trim() });
        if (coupon) {
          if (coupon.discountType === 'percentage') {
            let calc = (subtotal * coupon.discountAmount) / 100;
            discount = coupon.maxAmount ? Math.min(calc, coupon.maxAmount) : calc;
          } else {
            discount = coupon.discountAmount;
          }
          discount = Math.min(discount, subtotal);
        }
      }
      
      const tax = 0;
      const total = Math.max(0, subtotal - discount + tax);
      
      const checkoutDetail = {
        ...req.session.checkout,
        orderSummary: {
          subtotal: parseFloat(subtotal.toFixed(2)),
          discount: parseFloat(discount.toFixed(2)),
          tax: parseFloat(tax.toFixed(2)),
          total: parseFloat(total.toFixed(2))
        }
      };
      
      return res.render('payment', {
        user,
        messages: req.flash(),
        checkoutDetail,
        address: recalculated.addressDetails,
        items: recalculated.productList,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID
      });
    } catch (error) {
      console.log(`Temp order error:`, error);
      delete req.session.checkout;
      req.flash('error', 'Unable to calculate order details. Please try again.');
      return res.redirect('/checkout');
    }
  } catch (error) {
    console.log(`Payment controller error:`, error);
    delete req.session.checkout;
    req.flash('error', 'Payment session expired. Please checkout again.');
    return res.redirect('/checkout');
  }
};

export const paymentProcess = async (req, res) => {
  try {
    if (!req.session.checkout) {
      req.flash('error', 'Checkout session expired. Please try again.');
      return res.redirect('/checkout');
    }
    
    const userId = req.session.userDetail?._id;
    if (!userId) {
      req.flash('error', 'You must be logged in to complete payment.');
      return res.redirect('/login');
    }
    
    if (req.body.paymentMethod === 'cash') {
      let result;
      try {
        result = await cashOnDelivery(req);
        req.flash('success', 'Your order has been placed successfully! Payment to be made on delivery.');
      } catch (error) {
        console.log(`COD Error:`, error);
        throw error;
      }
      
      delete req.session.checkout;
      
      return res.redirect(`/payment/success?orderId=${result.orderId}`);
    }
    
    if (req.body.paymentMethod === 'online') {
      try {
        const paymentSession = await createRazorpayOrderSession(req);
        
        req.session.paymentSession = paymentSession;
        
        return res.json({
          success: true,
          razorpayOrderId: paymentSession.razorpayOrderId,
          amount: paymentSession.amount,
          currency: paymentSession.currency,
          key: process.env.RAZORPAY_KEY_ID,
          name: 'Casen',
          description: 'Order Payment',
          image: '/logo.png',
          order_details: paymentSession.orderDetails,
          paymentSessionId: paymentSession.paymentSessionId,
          contact: req.session.checkout.contact.phone || req.session.checkout.contact,
          email: req.session.userDetail.email
        });
      } catch (error) {
        console.error('Razorpay order creation error:', error);
        return res.json({ 
          success: false,
          message: 'Failed to initiate payment. Please try again.' 
        });
      }
    }
    
    if (req.body.paymentMethod === 'wallet') {
      req.flash('error', 'Wallet payment is not available at the moment. Please choose another payment method.');
      return res.redirect('/payment');
    }
    
    req.flash('error', 'Please select a valid payment method.');
    return res.redirect('/payment');
    
  } catch (error) {
    console.log(`Payment process error:`, error.toString());
    
    delete req.session.checkout;
    
    const errorMessage = error?.message || error?.error?.description || 'Payment failed. Please try again.';
    
    let flashMessage = 'Payment failed. Please try again.';
    if (errorMessage.includes && errorMessage.includes('usage limit')) {
      flashMessage = 'Coupon usage limit exceeded. Please try without coupon.';
    } else if (errorMessage.includes && errorMessage.includes('out of stock')) {
      flashMessage = errorMessage;
    } else if (errorMessage.includes && errorMessage.includes('Minimum order')) {
      flashMessage = errorMessage;
    } else if (errorMessage.includes && errorMessage.includes('not authenticated')) {
      return res.redirect('/login');
    } else if (errorMessage.includes && errorMessage.includes('receipt')) {
      flashMessage = 'Payment system error. Please try again later.';
    } else if (errorMessage.includes && errorMessage.includes('BAD_REQUEST_ERROR')) {
      flashMessage = error.error?.description || 'Payment gateway error. Please try again.';
    }
    
    req.flash('error', flashMessage);
    
    return res.json({ 
      success: false,
      message: flashMessage 
    });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    // console.log('=== PAYMENT VERIFICATION STARTED ===');
    // console.log('Session paymentSession:', req.session.paymentSession);
    // console.log('Query parameters:', req.query);
    // console.log('User session:', req.session.userDetail);
    
    const verificationData = req.query;
    
    if (!verificationData.paymentSessionId || !verificationData.razorpay_order_id || 
        !verificationData.razorpay_payment_id || !verificationData.razorpay_signature) {
      throw new Error('Missing verification parameters. Please try again.');
    }
    
    if (!req.session.paymentSession) {
      throw new Error('Payment session not found. Your session may have expired. Please try again.');
    }
    
    if (req.session.paymentSession.paymentSessionId !== verificationData.paymentSessionId) {
      throw new Error('Invalid payment session. Please try placing your order again.');
    }
    
    const order = await verifyRazorpayPayment({
      ...verificationData,
      paymentSession: req.session.paymentSession,
      userId: req.session.userDetail._id
    });
    
    delete req.session.checkout;
    delete req.session.paymentSession;
    
    // console.log('=== PAYMENT VERIFICATION COMPLETE ===');
    
    req.flash('success', 'Payment successful! Your order has been confirmed.');
    return res.redirect(`/payment/success?orderId=${order.orderId}`);
  } catch (error) {
    console.error('Payment verification error details:', {
      message: error.message,
      stack: error.stack
    });
    
    delete req.session.checkout;
    delete req.session.paymentSession;
    
    const errorMessage = error?.message || error?.error?.description || 'Payment verification failed. Please contact support.';
    
    let flashMessage = 'Payment verification failed. Please contact support.';
    if (errorMessage.includes && errorMessage.includes('signature')) {
      flashMessage = 'Payment verification failed. The payment may not have been completed.';
    } else if (errorMessage.includes && errorMessage.includes('session')) {
      flashMessage = 'Your payment session has expired. Please try placing your order again.';
    } else if (errorMessage.includes && errorMessage.includes('out of stock')) {
      flashMessage = errorMessage;
    } else if (errorMessage.includes && errorMessage.includes('Product variant not found')) {
      flashMessage = 'One or more products in your cart are no longer available. Please try again with available items.';
    }
    
    req.flash('error', flashMessage);
    
    console.error('Verification error details:', error);
    
    return res.redirect('/checkout');
  }
};

export const paymentSuccess = async (req, res) => {
  try {
    const user = req.session.userDetail;
    if (!user) {
      req.flash('error', 'You must be logged in to view order details.');
      return res.redirect('/login');
    }
    
    const orderId = req.query.orderId;
    if (!orderId) {
      req.flash('error', 'Order ID is missing.');
      return res.redirect('/profile/orders');
    }
    
    const order = await orderDetails(user._id, orderId);
    if (!order) {
      req.flash('error', 'Order not found or you do not have permission to view this order.');
      return res.redirect('/profile/orders');
    }
    
    return res.render('paymentSuccess', { 
      user,
      messages: req.flash(),
      order 
    });
  } catch (error) {
    console.log(`Payment success error:`, error);
    req.flash('error', 'Order details not found.');
    return res.redirect('/profile/orders');
  }
};