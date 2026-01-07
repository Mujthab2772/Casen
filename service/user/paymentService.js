import orderCollection from "../../models/orderModel.js";
import Payment from "../../models/paymentModel.js";
import razorpay from "../../config/razorpay.js";
import { v4 as uuidv4 } from "uuid";
import { ProductVariant } from "../../models/productVariantModel.js";
import { tempOrder, calculateFinalPrice } from "../../service/user/checkoutService.js";
import mongoose from 'mongoose';
import crypto from 'crypto';

function convertDecimal128ToNumber(value) {
  if (!value) return value;
  if (value.$numberDecimal !== undefined) {
    return parseFloat(value.$numberDecimal);
  }
  if (value.constructor && value.constructor.name === 'Decimal128') {
    return parseFloat(value.toString());
  }
  if (typeof value === 'object' && value.value !== undefined) {
    return parseFloat(value.value);
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const num = parseFloat(value);
    return isNaN(num) ? value : num;
  }
  return value;
}

function sanitizeOrderItems(items) {
  return items.map(item => ({
    ...item,
    price: convertDecimal128ToNumber(item.price),
    originalPrice: convertDecimal128ToNumber(item.originalPrice),
    quantity: parseInt(item.quantity) || 1
  }));
}

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
  
  const priceCalculation = await calculateFinalPrice(
    recalculated.subtotal, 
    appliedCouponCode, 
    userId
  );
  
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
      price: convertDecimal128ToNumber(i.price),
      originalPrice: convertDecimal128ToNumber(i.originalPrice),
      discountAmount: convertDecimal128ToNumber(i.discountAmount),
      hasOffer: i.hasOffer || false,
      offerInfo: i.offerInfo || null,
      images: i.images,
      orderStatus: 'pending'
    })),
    subTotal: priceCalculation.subtotal,
    discountAmount: priceCalculation.discount,
    taxAmount: priceCalculation.tax,
    totalAmount: priceCalculation.total,
    paymentId: uuidv4(),
    paymentStatus: 'pending',
    paymentMethod: 'cash',
    orderStatus: 'pending'
  };
  
  if (priceCalculation.appliedCoupon) {
    orderData.appliedCoupon = priceCalculation.appliedCoupon;
  }
  
  if (recalculated.offersApplied) {
    orderData.hasProductOffers = true;
  }
  
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

export const createRazorpayOrderSession = async (req) => {
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
  
  const priceCalculation = await calculateFinalPrice(
    recalculated.subtotal, 
    appliedCouponCode, 
    userId
  );
  
  const paymentSessionId = uuidv4();
  
  
  const orderDetails = {
    userId,
    address: recalculated.addressDetails,
    contactEmail: req.session.userDetail.email,
    items: recalculated.productList.map(i => ({
      productId: i.productId,
      productName: i.productName,
      variantId: i.variantId,
      variantColor: i.variantColor,
      quantity: i.quantity,
      price: convertDecimal128ToNumber(i.price),
      originalPrice: convertDecimal128ToNumber(i.originalPrice),
      discountAmount: convertDecimal128ToNumber(i.discountAmount),
      hasOffer: i.hasOffer || false,
      offerInfo: i.offerInfo || null,
      images: i.images
    })),
    subTotal: priceCalculation.subtotal,
    discountAmount: priceCalculation.discount,
    taxAmount: priceCalculation.tax,
    totalAmount: priceCalculation.total,
    hasProductOffers: recalculated.offersApplied,
    appliedCoupon: priceCalculation.appliedCoupon || null
  };
  
  const shortReceiptId = `session_${paymentSessionId.substring(0, 27)}`;
  const razorpayOrder = await razorpay.orders.create({
    amount: Math.round(priceCalculation.total * 100),
    currency: "INR",
    receipt: shortReceiptId,
    notes: {
      userId: userId.toString(),
      email: req.session.userDetail.email,
      paymentSessionId: paymentSessionId
    }
  });
  
  return {
    paymentSessionId,
    razorpayOrderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    orderDetails
  };
};

export const verifyRazorpayPayment = async ({
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
  paymentSession,
  userId
}) => {
  try {
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest('hex');
    if (generated_signature !== razorpay_signature) {
      throw new Error('Payment verification failed: Invalid signature');
    }
    
    const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
    
    
    let existingOrder = await orderCollection.findOne({
      'paymentSession.paymentSessionId': paymentSession.paymentSessionId
    });
    if (existingOrder) {
      console.log('Order already exists for this payment session');
      return existingOrder;
    }
    
    const orderId = uuidv4();
    const paymentId = uuidv4();
    const sanitizedItems = sanitizeOrderItems(paymentSession.orderDetails.items);
    
    
    for (const item of sanitizedItems) {
      const variant = await ProductVariant.findOne(
        { variantId: item.variantId, isActive: true },
        { stock: 1, name: 1 }
      );
      if (!variant) {
        throw new Error(`Product variant not found: ${item.variantId} for ${item.productName || 'unknown product'}`);
      }
      if (variant.stock < item.quantity) {
        throw new Error(`"${item.productName || 'Product'}" is out of stock. Only ${variant.stock} available.`);
      }
    }
    
    
    const orderData = {
      orderId,
      userId,
      address: paymentSession.orderDetails.address,
      contactEmail: paymentSession.orderDetails.contactEmail || paymentSession.orderDetails.address.email,
      items: sanitizedItems.map(i => ({
        orderItemId: uuidv4(),
        productId: i.productId,
        productName: i.productName,
        variantId: i.variantId,
        variantColor: i.variantColor || 'N/A',
        quantity: i.quantity,
        price: convertDecimal128ToNumber(i.price),
        originalPrice: convertDecimal128ToNumber(i.originalPrice),
        discountAmount: convertDecimal128ToNumber(i.discountAmount),
        hasOffer: i.hasOffer || false,
        offerInfo: i.offerInfo || null,
        images: Array.isArray(i.images) ? i.images : (i.images ? [i.images] : []),
        orderStatus: 'confirmed'
      })),
      subTotal: convertDecimal128ToNumber(paymentSession.orderDetails.subTotal),
      discountAmount: convertDecimal128ToNumber(paymentSession.orderDetails.discountAmount) || 0,
      taxAmount: convertDecimal128ToNumber(paymentSession.orderDetails.taxAmount) || 0,
      totalAmount: convertDecimal128ToNumber(paymentSession.orderDetails.totalAmount),
      paymentId,
      paymentStatus: 'paid',
      paymentMethod: 'online',
      orderStatus: 'confirmed',
      paymentSession: {
        paymentSessionId: paymentSession.paymentSessionId,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id
      },
      hasProductOffers: paymentSession.orderDetails.hasProductOffers || false
    };
    
    
    if (paymentSession.orderDetails.appliedCoupon) {
      orderData.appliedCoupon = {
        ...paymentSession.orderDetails.appliedCoupon,
        discountAmount: convertDecimal128ToNumber(paymentSession.orderDetails.appliedCoupon.discountAmount)
      };
    }
    
    let order;
    let paymentRecord;
    
    try {
      const session = await mongoose.startSession();
      session.startTransaction();
      
      try {
        order = new orderCollection(orderData);
        await order.save({ session });
        console.log('Order created successfully:', order.orderId);
        
        
        for (const item of order.items) {
          const updateResult = await ProductVariant.updateOne(
            { variantId: item.variantId },
            { $inc: { stock: -item.quantity } },
            { session }
          );
          if (updateResult.modifiedCount === 0) {
            throw new Error(`Failed to update stock for product: ${item.productName}`);
          }
        }
        
        
        paymentRecord = new Payment({
          paymentId,
          orderId: order._id,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          method: paymentDetails.method,
          amount: convertDecimal128ToNumber(paymentSession.orderDetails.totalAmount),
          status: 'captured',
          paidAt: new Date(),
          customerDetails: {
            contact: paymentSession.orderDetails.address.phoneNumber || paymentSession.orderDetails.address.phone,
            email: paymentSession.orderDetails.contactEmail || paymentSession.orderDetails.address.email,
            shippingAddress: paymentSession.orderDetails.address
          },
          razorpayResponse: {
            orderId: razorpay_order_id,
            paymentId: razorpay_payment_id,
            signature: razorpay_signature,
            method: paymentDetails.method,
            status: paymentDetails.status,
            amount: paymentDetails.amount / 100
          }
        });
        await paymentRecord.save({ session });
        
        await session.commitTransaction();
        session.endSession();
        return order;
      } catch (transactionError) {
        await session.abortTransaction();
        session.endSession();
        throw transactionError;
      }
    } catch (orderError) {
      console.error('Detailed order creation error:', orderError);
      
      
      if (paymentDetails.status === 'captured') {
        try {
          console.log('Attempting to refund payment:', razorpay_payment_id);
          const refund = await razorpay.payments.refund(razorpay_payment_id, {
            amount: convertDecimal128ToNumber(paymentSession.orderDetails.totalAmount) * 100 // in paise
          });
          console.log('Refund successful:', refund);
        } catch (refundError) {
          console.error('Refund failed:', refundError);
        }
      }
      
      
      if (order && order._id) {
        try {
          await orderCollection.findByIdAndDelete(order._id);
          console.log('Partial order cleaned up:', order.orderId);
        } catch (cleanupError) {
          console.error('Order cleanup failed:', cleanupError);
        }
      }
      
      let errorMessage = 'Order creation failed after payment. Payment has been refunded.';
      if (orderError.message.includes('out of stock')) {
        errorMessage = orderError.message;
      } else if (orderError.message.includes('Product variant not found')) {
        errorMessage = 'One or more products in your cart are no longer available. Please try again with available items.';
      } else if (orderError.name === 'ValidationError') {
        errorMessage = 'There was an issue with your order details. Please try again.';
      }
      throw new Error(errorMessage);
    }
  } catch (error) {
    console.error('Payment verification failed:', error);
    throw error;
  }
};

export const orderDetails = async (userId, orderId) => {
  return await orderCollection.findOne({ userId, orderId });
};