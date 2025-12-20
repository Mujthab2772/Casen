import orderCollection from "../../models/orderModel.js";
import { v4 as uuidv4 } from "uuid";
import { ProductVariant } from "../../models/productVariantModel.js";
import { couponDetails, tempOrder } from "../../service/user/checkoutService.js";

export const cashOnDelivery = async (req) => {
  const userId = req.session.userDetail?._id;
  if (!userId) throw new Error('User not authenticated');
  if (!req.session.checkout) throw new Error('Checkout session expired');

  const { shippingAddressId, contact, appliedCouponCode } = req.session.checkout;

  const recalculated = await tempOrder(userId, {
    shippingAddressId,
    contact
  });

  if (!recalculated?.productList?.length) {
    throw new Error('Cart is empty or contains invalid items');
  }

  for (const item of recalculated.productList) {
    const variant = await ProductVariant.findOne(
      { variantId: item.variantId, isActive: true },
      { stock: 1 }
    );
    if (!variant || variant.stock < item.quantity) {
      throw new Error(`"${item.productName}" is out of stock.`);
    }
  }

  let subtotal = recalculated.productList.reduce((s, i) => s + i.price * i.quantity, 0);
  let discount = 0;
  let appliedCoupon = null;

  if (appliedCouponCode) {
    const coupon = await couponDetails({ couponCode: appliedCouponCode.trim() });
    
    if (!coupon || !coupon.isActive) {
      throw new Error('Coupon is no longer valid');
    }

    const now = new Date();
    if (now < coupon.startDate || now > coupon.endDate) {
      throw new Error('Coupon is not active');
    }

    if (subtotal < coupon.minAmount) {
      throw new Error(`Minimum order ₹${coupon.minAmount} required`);
    }

    const usageCount = await orderCollection.countDocuments({
      userId,
      'appliedCoupon.couponId': coupon.couponId
    });

    if (usageCount >= coupon.perUserLimit) {
      throw new Error('Coupon usage limit exceeded');
    }

    if (coupon.discountType === 'percentage') {
      let calc = (subtotal * coupon.discountAmount) / 100;
      discount = coupon.maxAmount ? Math.min(calc, coupon.maxAmount) : calc;
    } else {
      discount = coupon.discountAmount;
    }

    discount = Math.min(discount, subtotal);
    appliedCoupon = {
      couponId: coupon.couponId,
      couponCode: coupon.couponCode,
      discountAmount: parseFloat(discount.toFixed(2))
    };
  }

  const total = subtotal - discount;
  
  const orderData = {
    orderId: uuidv4(),
    userId,
    address: recalculated.addressDetails,
    items: recalculated.productList.map(i => ({
      orderItemId: uuidv4(),
      productId: i.productId,
      productName: i.productName,
      variantId: i.variantId,
      variantColor: i.variantColor,
      quantity: i.quantity,
      price: i.price,
      images: i.images,
      orderStatus: 'pending'
    })),
    subTotal: parseFloat(subtotal.toFixed(2)),
    discountAmount: parseFloat(discount.toFixed(2)),
    taxAmount: 0,
    totalAmount: parseFloat(total.toFixed(2)),
    paymentId: uuidv4(),
    paymentStatus: 'pending',
    orderStatus: 'pending'
  };

  if (appliedCoupon) orderData.appliedCoupon = appliedCoupon;

  const order = new orderCollection(orderData);
  await order.save();

  for (const item of recalculated.productList) {
    await ProductVariant.updateOne(
      { variantId: item.variantId },
      { $inc: { stock: -item.quantity } }
    );
  }

  return order;
};

export const orderDetails = async (userId, orderId) => {
  return await orderCollection.findOne({ userId, orderId });
};