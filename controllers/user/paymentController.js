import razorpay from "../../config/razorpay.js";
import Cart from "../../models/cartModel.js";
import orderModal from "../../models/orderModel.js";
import { Wallet } from "../../models/walletModel.js";
import {
  tempOrder,
  calculateFinalPrice
} from "../../service/user/checkoutService.js";
import {
  cashOnDelivery,
  createRazorpayOrderSession,
  verifyRazorpayPayment,
  orderDetails,
  walletPayment
} from "../../service/user/paymentService.js";
import crypto from 'crypto';
import logger from '../../util/logger.js'; // ✅ Add logger import

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
      const wallet = await Wallet.findOne({ userId });
      user.walletBalance = wallet ? parseFloat(wallet.balance.amount.toString()) : 0;
      
      const recalculated = await tempOrder(userId, {
        shippingAddressId,
        contact
      });
      
      if (!recalculated?.productList?.length) {
        delete req.session.checkout;
        req.flash('error', 'Your cart is empty or contains invalid items.');
        return res.redirect('/cart');
      }
      
      let subtotal = 0;
      recalculated.productList.forEach(item => {
        subtotal += item.price * item.quantity;
      });
      
      const priceCalculation = await calculateFinalPrice(
        subtotal,
        appliedCouponCode,
        userId
      );
      
      const checkoutDetail = {
        ...req.session.checkout,
        orderSummary: {
          subtotal: priceCalculation.subtotal,
          discount: priceCalculation.discount,
          tax: priceCalculation.tax,
          total: priceCalculation.total,
          hasProductOffers: false 
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
      logger.error(`Temp order error: ${error.message}`);
      delete req.session.checkout;
      req.flash('error', 'Unable to calculate order details. Please try again.');
      return res.redirect('/checkout');
    }
  } catch (error) {
    logger.error(`Payment controller error: ${error.message}`);
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
        logger.error(`COD Error: ${error.message}`);
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
        logger.error(`Razorpay order creation error: ${error.message}`);
        return res.json({
          success: false,
          message: 'Failed to initiate payment. Please try again.'
        });
      }
    }
    if (req.body.paymentMethod === 'wallet') {
      try {
        const result = await walletPayment(req);
        req.flash('success', 'Payment successful! Your order has been placed using wallet balance.');
        delete req.session.checkout;
        return res.redirect(`/payment/success?orderId=${result.orderId}`);
      } catch (error) {
        logger.error(`Wallet payment error: ${error.message}`);
        let flashMessage = 'Wallet payment failed. Please try again.';
        if (error.message.includes('Insufficient wallet balance')) {
          flashMessage = error.message;
        } else if (error.message.includes('Wallet not found')) {
          flashMessage = 'Please create a wallet and add funds first.';
        } else if (error.message.includes('out of stock')) {
          flashMessage = error.message;
        } else if (error.message.includes('not authenticated')) {
          return res.redirect('/login');
        }
        req.flash('error', flashMessage);
        return res.redirect('/payment');
      }
    }
    req.flash('error', 'Please select a valid payment method.');
    return res.redirect('/payment');
  } catch (error) {
    logger.error(`Payment process error: ${error.toString()}`);
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
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(verificationData.razorpay_order_id + "|" + verificationData.razorpay_payment_id);
    const generated_signature = hmac.digest('hex');
    if (generated_signature !== verificationData.razorpay_signature) {
      throw new Error('Payment verification failed: Invalid signature');
    }
    const paymentDetails = await razorpay.payments.fetch(verificationData.razorpay_payment_id);

    if (paymentDetails.status !== 'captured') {
      const failDetails = {
        reason: `Payment status: ${paymentDetails.status}. ${paymentDetails.error_description || 'Payment was not completed.'}`,
        timestamp: new Date().toISOString()
      };
      req.session.paymentFailDetails = failDetails;
      delete req.session.paymentSession;
      req.flash('error', 'Payment was not completed. Please try again.');
      return res.redirect('/payment/fail');
    }

    const order = await verifyRazorpayPayment({
      ...verificationData,
      paymentSession: req.session.paymentSession,
      userId: req.session.userDetail._id
    });
    delete req.session.checkout;
    delete req.session.paymentSession;
    req.flash('success', 'Payment successful! Your order has been confirmed.');
    return res.redirect(`/payment/success?orderId=${order.orderId}`);
  } catch (error) {
    logger.error(`Verification error: ${error.message}`);
    const failDetails = {
      reason: error.message || 'An unexpected error occurred during payment verification.',
      timestamp: new Date().toISOString()
    };
    req.session.paymentFailDetails = failDetails;
    delete req.session.paymentSession;
    let flashMessage = 'Payment verification failed. Please try again.';
    const msg = error.message || '';
    if (msg.includes('signature')) {
      flashMessage = 'Payment verification failed. The payment may not have been completed.';
    } else if (msg.includes('session')) {
      flashMessage = 'Your payment session has expired. Please try placing your order again.';
    } else if (msg.includes('out of stock') || msg.includes('Product variant not found')) {
      flashMessage = msg;
    }
    req.flash('error', flashMessage);
    return res.redirect('/payment/fail');
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
    
    await Cart.deleteMany({});
    return res.render('paymentSuccess', {
      user,
      messages: req.flash(),
      order
    });
  } catch (error) {
    logger.error(`Payment success error: ${error.message}`);
    req.flash('error', 'Order details not found.');
    return res.redirect('/profile/orders');
  }
};

export const paymentFail = async (req, res) => {
  try {
    const user = req.session.userDetail;
    if (!user) {
      req.flash('error', 'You must be logged in to view this page.');
      return res.redirect('/login');
    }

    const errorDetails = {
      code: req.query.code ? decodeURIComponent(req.query.code) : null,
      description: req.query.description ? decodeURIComponent(req.query.description) : null,
      step: req.query.step ? decodeURIComponent(req.query.step) : null,
      reason: req.query.reason ? decodeURIComponent(req.query.reason) : null
    };

    const sessionErrorDetails = req.session.paymentFailDetails || {
      reason: req.flash('error')[0] || 'Payment failed',
      timestamp: new Date().toISOString()
    };

    if (errorDetails.code && errorDetails.description) {
      sessionErrorDetails.razorpayError = errorDetails;
    }

    delete req.session.paymentFailDetails;

    return res.render('paymentFail', {
      user,
      messages: req.flash(),
      errorDetails: sessionErrorDetails,
      orderId: req.query.orderId || null
    });
  } catch (error) {
    logger.error(`Payment fail page error: ${error.message}`);
    req.flash('error', 'Unable to load payment failure page.');
    return res.redirect('/profile/orders');
  }
};