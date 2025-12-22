import orderModal from "../../models/orderModel.js";
import { addressDetails } from "../../service/user/addressService.js";
import { cartDetails } from "../../service/user/cartService.js";
import { couponDetails, getValidCouponsForUser, tempOrder } from "../../service/user/checkoutService.js";
import { STATUS_CODE } from "../../util/statusCodes.js";

export const checkout = async (req, res) => {
  try {
    const user = req.session.userDetail;
    if (!user) {
      req.flash('error', 'You must be logged in to checkout.');
      return res.redirect('/login');
    }

    const userId = user._id;
    const cartProducts = await cartDetails(userId);
    const userAddresses = await addressDetails(userId);

    let subtotal = 0;
    for (const item of cartProducts) {
      const { quantity, variant } = item.products;
      if (quantity <= variant.stock) {
        subtotal += variant.price * quantity;
      }
      
    }

    const validCoupons = await getValidCouponsForUser(userId, subtotal);
    const availableCoupons = validCoupons.map(c => ({
      couponCode: c.couponCode,
      description: c.description || 'Discount coupon',
      discountType: c.discountType,
      discountAmount: c.discountAmount,
      minAmount: c.minAmount,
      maxAmount: c.maxAmount || null
    }));

    return res.render('checkout', {
      user,
      cartProducts,
      userAddresses: userAddresses.addresses,
      availableCoupons: availableCoupons || null, // FIXED: Don't stringify here
      subtotal,
      messages: req.flash()
    });
  } catch (error) {
    console.log(`Checkout error:`, error);
    req.flash('error', 'An error occurred while loading checkout. Please try again.');
    return res.redirect('/cart');
  }
};

export const checkoutDatas = async (req, res) => {
  try {
    const userId = req.session.userDetail._id;
    const { contact, shippingAddressId, coupon: appliedCouponCode } = req.body;
    
    req.session.checkout = {
      contact,
      shippingAddressId,
      appliedCouponCode 
    };
    
    return res.status(STATUS_CODE.OK).json({ success: true });
  } catch (error) {
    console.log(`checkoutDatas error:`, error);
    return res.status(500).json({
      success: false,
      message: "Unable to process checkout. Please try again."
    });
  }
};

export const previewCheckout = async (req, res) => {
  try {
    const userId = req.session.userDetail._id;
    const { shippingAddressId, contact, couponCode } = req.body;

    if (!shippingAddressId || !contact?.email || !contact?.phone) {
      return res.status(400).json({ 
        success: false,
        error: "Missing required contact information or shipping address." 
      });
    }

    const recalculated = await tempOrder(userId, { shippingAddressId, contact });
    if (!recalculated.productList?.length) {
      return res.status(400).json({ 
        success: false,
        error: "Cart is empty or contains invalid items." 
      });
    }

    let subtotal = 0;
    recalculated.productList.forEach(item => {
      subtotal += item.price * item.quantity;
    });

    let discount = 0;
    let validCoupon = null;

    if (couponCode && couponCode.trim()) {
      const coupon = await couponDetails({ couponCode: couponCode.trim() });
      if (coupon) {
        const now = new Date();
        if (now >= coupon.startDate && now <= coupon.endDate && subtotal >= coupon.minAmount) {
          if (coupon.perUserLimit > 0) {
            const usage = await orderModal.countDocuments({
              userId,
              'appliedCoupon.couponId': coupon.couponId
            });
            if (usage < coupon.perUserLimit) {
              if (coupon.discountType === 'percentage') {
                const calc = (subtotal * coupon.discountAmount) / 100;
                discount = coupon.maxAmount ? Math.min(calc, coupon.maxAmount) : calc;
              } else {
                discount = coupon.discountAmount;
              }
              validCoupon = couponCode;
            }
          } else {
            if (coupon.discountType === 'percentage') {
              const calc = (subtotal * coupon.discountAmount) / 100;
              discount = coupon.maxAmount ? Math.min(calc, coupon.maxAmount) : calc;
            } else {
              discount = coupon.discountAmount;
            }
            validCoupon = couponCode;
          }
        }
      }
    }

    const tax = 0;
    const total = Math.max(0, subtotal - discount + tax);

    return res.json({
      success: true,
      subtotal: parseFloat(subtotal.toFixed(2)),
      discount: parseFloat(discount.toFixed(2)),
      tax: parseFloat(tax.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      validCoupon: validCoupon
    });
  } catch (error) {
    console.log('Preview error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to preview order. Please try again.' 
    });
  }
};

export const getAvailableCoupons = async (req, res) => {
  try {
    const user = req.session.userDetail;
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const userId = user._id;
    const subtotal = parseFloat(req.query.subtotal) || 0;

    // Get valid coupons for user
    const validCoupons = await getValidCouponsForUser(userId, subtotal);
    
    // Format coupons for frontend
    const coupons = validCoupons.map(c => ({
      couponCode: c.couponCode,
      description: c.description || 'Discount coupon',
      discountType: c.discountType,
      discountAmount: c.discountAmount,
      minAmount: c.minAmount,
      maxAmount: c.maxAmount || null
    }));

    return res.json({ 
      success: true,
      coupons,
      count: coupons.length
    });
  } catch (error) {
    console.error('Get coupons error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch available coupons' 
    });
  }
};