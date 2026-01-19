import orderCollection from "../../models/orderModel.js";
import Payment from "../../models/paymentModel.js";
import razorpay from "../../config/razorpay.js";
import { v4 as uuidv4 } from "uuid";
import { ProductVariant } from "../../models/productVariantModel.js";
import { tempOrder, calculateFinalPrice } from "../../service/user/checkoutService.js";
import mongoose from 'mongoose';
import crypto from 'crypto';
import { Wallet } from "../../models/walletModel.js";
import { Transaction } from "../../models/transactionsModel.js";
import logger from '../../util/logger.js'; // ✅ Add logger import

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

function sanitizeOrderItemsForSchema(items) {
  return items.map(item => {
    let images = [];
    if (Array.isArray(item.images)) {
      images = item.images.slice(0, 3);
    } else if (item.images) {
      images = [item.images].slice(0, 3);
    }

    return {
      orderItemId: uuidv4(),
      productId: item.productId,
      productName: item.productName,
      variantId: item.variantId,
      variantColor: item.variantColor || 'N/A',
      quantity: parseInt(item.quantity) || 1,
      price: convertDecimal128ToNumber(item.price),
      images: images,
      orderStatus: 'confirmed'
    };
  });
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
  
  const sanitizedAddress = {
    ...recalculated.addressDetails,
    email: req.session.userDetail.email || recalculated.addressDetails.email
  };
  
  let appliedCouponData = null;
  if (priceCalculation.appliedCoupon) {
    appliedCouponData = {
      couponId: priceCalculation.appliedCoupon.couponId,
      couponCode: priceCalculation.appliedCoupon.couponCode,
      discountAmount: convertDecimal128ToNumber(priceCalculation.appliedCoupon.discountAmount)
    };
  }
  
  const sanitizedItems = sanitizeOrderItemsForSchema(recalculated.productList);
  
  const orderData = {
    orderId: uuidv4(),
    userId,
    address: sanitizedAddress,
    items: sanitizedItems,
    subTotal: priceCalculation.subtotal,
    discountAmount: priceCalculation.discount,
    taxAmount: priceCalculation.tax,
    totalAmount: priceCalculation.total,
    paymentId: uuidv4(),
    paymentStatus: 'pending',
    orderStatus: 'pending'
  };
  
  if (appliedCouponData) {
    orderData.appliedCoupon = appliedCouponData;
  }
  
  const order = new orderCollection(orderData);
  await order.save();
  
  for (const item of sanitizedItems) {
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
  
  const sanitizedAddress = {
    ...recalculated.addressDetails,
    email: req.session.userDetail.email || recalculated.addressDetails.email
  };
  
  let appliedCouponData = null;
  if (priceCalculation.appliedCoupon) {
    appliedCouponData = {
      couponId: priceCalculation.appliedCoupon.couponId,
      couponCode: priceCalculation.appliedCoupon.couponCode,
      discountAmount: convertDecimal128ToNumber(priceCalculation.appliedCoupon.discountAmount)
    };
  }
  
  const orderDetails = {
    userId,
    address: sanitizedAddress,
    contactEmail: req.session.userDetail.email,
    items: recalculated.productList.map(i => ({
      productId: i.productId,
      productName: i.productName,
      variantId: i.variantId,
      variantColor: i.variantColor,
      quantity: i.quantity,
      price: convertDecimal128ToNumber(i.price),
      images: i.images
    })),
    subTotal: priceCalculation.subtotal,
    discountAmount: priceCalculation.discount,
    taxAmount: priceCalculation.tax,
    totalAmount: priceCalculation.total,
    appliedCoupon: appliedCouponData
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
      logger.info('Order already exists for this payment session');
      return existingOrder;
    }
    
    const addressDetails = paymentSession.orderDetails.address;
    const sanitizedAddress = {
      ...addressDetails,
      email: paymentSession.orderDetails.contactEmail || addressDetails.email
    };
    
    const sanitizedItems = sanitizeOrderItemsForSchema(paymentSession.orderDetails.items);
    
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
    
    let appliedCouponData = null;
    if (paymentSession.orderDetails.appliedCoupon) {
      appliedCouponData = {
        couponId: paymentSession.orderDetails.appliedCoupon.couponId,
        couponCode: paymentSession.orderDetails.appliedCoupon.couponCode,
        discountAmount: convertDecimal128ToNumber(
          paymentSession.orderDetails.appliedCoupon.discountAmount
        )
      };
    }
    
    const orderData = {
      orderId: uuidv4(),
      userId,
      address: sanitizedAddress,
      items: sanitizedItems,
      subTotal: convertDecimal128ToNumber(paymentSession.orderDetails.subTotal),
      discountAmount: convertDecimal128ToNumber(paymentSession.orderDetails.discountAmount) || 0,
      taxAmount: convertDecimal128ToNumber(paymentSession.orderDetails.taxAmount) || 0,
      totalAmount: convertDecimal128ToNumber(paymentSession.orderDetails.totalAmount),
      paymentId: uuidv4(),
      paymentStatus: 'paid',
      orderStatus: 'confirmed'
    };
    
    if (appliedCouponData) {
      orderData.appliedCoupon = appliedCouponData;
    }
    
    let order;
    let paymentRecord;
    
    try {
      const session = await mongoose.startSession();
      session.startTransaction();
      
      try {
        order = new orderCollection(orderData);
        await order.save({ session });
        logger.info(`Order created successfully: ${order.orderId}`);
        
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
          paymentId: order.paymentId,
          orderId: order._id,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          method: paymentDetails.method,
          amount: order.totalAmount,
          status: 'captured',
          paidAt: new Date(),
          customerDetails: {
            contact: sanitizedAddress.phoneNumber || sanitizedAddress.phone,
            email: sanitizedAddress.email,
            shippingAddress: sanitizedAddress
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
      logger.error(`Detailed order creation error: ${orderError.message}`, orderError);
      
      if (paymentDetails.status === 'captured') {
        try {
          logger.info(`Attempting to refund payment: ${razorpay_payment_id}`);
          const refund = await razorpay.payments.refund(razorpay_payment_id, {
            amount: Math.round(orderData.totalAmount * 100)
          });
          logger.info(`Refund successful: ${refund.id}`);
        } catch (refundError) {
          logger.error(`Refund failed: ${refundError.message}`, refundError);
        }
      }
      
      if (order && order._id) {
        try {
          await orderCollection.findByIdAndDelete(order._id);
          logger.info(`Partial order cleaned up: ${order.orderId}`);
        } catch (cleanupError) {
          logger.error(`Order cleanup failed: ${cleanupError.message}`, cleanupError);
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
    logger.error(`Payment verification failed: ${error.message}`, error);
    throw error;
  }
};

export const walletPayment = async (req) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const userId = req.session.userDetail?._id;
    if (!userId) throw new Error('User not authenticated');
    
    if (!req.session.checkout) throw new Error('Checkout session expired');
    
    const { shippingAddressId, contact, appliedCouponCode } = req.session.checkout;
    
    const wallet = await Wallet.findOne({ userId }).session(session);
    if (!wallet) {
      throw new Error('Wallet not found. Please add funds to your wallet first.');
    }
    
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
      ).session(session);
      
      if (!variant || variant.stock < item.quantity) {
        throw new Error(`"${item.productName}" is out of stock.`);
      }
    }
    
    const priceCalculation = await calculateFinalPrice(
      recalculated.subtotal, 
      appliedCouponCode, 
      userId
    );
    
    const orderTotal = priceCalculation.total;
    
    const walletBalance = parseFloat(wallet.balance.amount.toString());
    if (walletBalance < orderTotal) {
      throw new Error(`Insufficient wallet balance. Your balance is ₹${walletBalance.toFixed(2)} but order total is ₹${orderTotal.toFixed(2)}.`);
    }
    
    const sanitizedAddress = {
      ...recalculated.addressDetails,
      email: req.session.userDetail.email || recalculated.addressDetails.email
    };
    
    let appliedCouponData = null;
    if (priceCalculation.appliedCoupon) {
      appliedCouponData = {
        couponId: priceCalculation.appliedCoupon.couponId,
        couponCode: priceCalculation.appliedCoupon.couponCode,
        discountAmount: convertDecimal128ToNumber(priceCalculation.appliedCoupon.discountAmount)
      };
    }
    
    const sanitizedItems = sanitizeOrderItemsForSchema(recalculated.productList);
    
    const orderData = {
      orderId: uuidv4(),
      userId,
      address: sanitizedAddress,
      items: sanitizedItems,
      subTotal: priceCalculation.subtotal,
      discountAmount: priceCalculation.discount,
      taxAmount: priceCalculation.tax,
      totalAmount: priceCalculation.total,
      paymentId: uuidv4(),
      paymentStatus: 'paid',
      orderStatus: 'confirmed'
    };
    
    if (appliedCouponData) {
      orderData.appliedCoupon = appliedCouponData;
    }
    
    const order = new orderCollection(orderData);
    await order.save({ session });
    
    const deductionAmount = new mongoose.Types.Decimal128((-orderTotal).toFixed(2));
    
    const updatedWallet = await Wallet.findByIdAndUpdate(
      wallet._id,
      { 
        $inc: { 
          'balance.amount': deductionAmount
        }
      },
      { new: true, session }
    );
    
    if (!updatedWallet) {
      throw new Error('Failed to update wallet balance. Please try again.');
    }
    
    const transaction = new Transaction({
      wallet: wallet._id,
      amount: new mongoose.Types.Decimal128(orderTotal.toFixed(2)),
      currency: wallet.balance.currency,
      type: 'payment',
      status: 'completed',
      description: `Payment for order ${order.orderId}`,
      reference: {
        orderId: order.orderId
      }
    });
    
    await transaction.save({ session });
    
    for (const item of sanitizedItems) {
      const updateResult = await ProductVariant.updateOne(
        { variantId: item.variantId },
        { $inc: { stock: -item.quantity } },
        { session }
      );
      
      if (updateResult.modifiedCount === 0) {
        throw new Error(`Failed to update stock for product: ${item.productName}`);
      }
    }
    
    await session.commitTransaction();
    session.endSession();
    
    return order;
    
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error(`Wallet payment error: ${error.message}`, error);
    throw error;
  }
};

export const orderDetails = async (userId, orderId) => {
  return await orderCollection.findOne({ userId, orderId });
};