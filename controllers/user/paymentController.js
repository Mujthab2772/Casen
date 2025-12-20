import { couponDetails, tempOrder } from "../../service/user/checkoutService.js";
import { cashOnDelivery, orderDetails } from "../../service/user/paymentService.js";

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
        items: recalculated.productList
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
    
    let result = null;
    
    // Handle Cash on Delivery
    if (req.body.paymentMethod === 'cash') {
      try {
        result = await cashOnDelivery(req);
        req.flash('success', 'Your order has been placed successfully! Payment to be made on delivery.');
      } catch (error) {
        console.log(`COD Error:`, error);
        throw error;
      }
    } 
    // Handle Online Payment (not implemented in provided code, this is a placeholder)
    else if (req.body.paymentMethod === 'online') {
      // This would handle Razorpay/PayPal integration
      // For now, we'll just redirect with an error
      req.flash('error', 'Online payment is not available at the moment. Please choose Cash on Delivery.');
      return res.redirect('/payment');
    }
    // Handle Wallet Payment (placeholder)
    else if (req.body.paymentMethod === 'wallet') {
      req.flash('error', 'Wallet payment is not available at the moment. Please choose Cash on Delivery.');
      return res.redirect('/payment');
    }
    
    // Clear the checkout session after successful payment processing
    delete req.session.checkout;
    
    // Redirect to success page with order ID
    return res.redirect(`/payment/success?orderId=${result.orderId}`);
    
  } catch (error) {
    console.log(`Payment process error:`, error.message || error);
    
    // Clear session on error to prevent stale data
    delete req.session.checkout;
    
    let errorMessage = 'Payment failed. Please try again.';
    if (error.message.includes('usage limit')) {
      errorMessage = 'Coupon usage limit exceeded. Please try without coupon.';
    } else if (error.message.includes('out of stock')) {
      errorMessage = error.message;
    } else if (error.message.includes('Minimum order')) {
      errorMessage = error.message;
    } else if (error.message.includes('not authenticated')) {
      return res.redirect('/login');
    }
    
    req.flash('error', errorMessage);
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