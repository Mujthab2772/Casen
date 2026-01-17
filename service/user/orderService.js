// orderService.js
import orderModal from "../../models/orderModel.js";
import { ProductVariant } from "../../models/productVariantModel.js";
import mongoose from "mongoose";
import { Wallet } from "../../models/walletModel.js";
import { Transaction } from "../../models/transactionsModel.js";

async function refundToWallet(userId, amount, orderId, description) {
  try {
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = new Wallet({
        userId,
        balance: {
          amount: new mongoose.Types.Decimal128("0.00"),
          currency: 'INR'
        }
      });
      await wallet.save();
    }

    const currentBalance = parseFloat(wallet.balance.amount.toString());
    const refundAmount = parseFloat(amount.toString());
    const newBalance = (currentBalance + refundAmount).toFixed(2);
    
    wallet.balance.amount = new mongoose.Types.Decimal128(newBalance);
    await wallet.save();

    const transaction = new Transaction({
      wallet: wallet._id,
      amount: new mongoose.Types.Decimal128(refundAmount.toFixed(2)),
      currency: 'INR',
      type: 'refund',
      status: 'completed',
      description: description || `Refund for order ${orderId}`,
      reference: { orderId: orderId.toString() }
    });
    await transaction.save();

    return { success: true, wallet, transaction };
  } catch (error) {
    console.error('Wallet refund failed:', error);
    throw new Error('Failed to process wallet refund');
  }
}

export const listOrder = async (userId, page = 1, limit = 4, status = 'all', search = '') => {
  try {
    const filter = { userId };

    if (search) {
      filter.orderId = { $regex: search, $options: 'i' };
    }

    if (status === 'active') {
      filter.orderStatus = { $nin: ['delivered', 'cancelled', 'returned', 'requestingReturn'] };
    } else if (status === 'delivered') {
      filter.orderStatus = 'delivered';
    } else if (status !== 'all') {
      filter.orderStatus = status;
    }

    const totalOrders = await orderModal.countDocuments(filter);
    const totalPages = Math.ceil(totalOrders / limit);

    const orderDatas = await orderModal
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      orders: orderDatas,
      pagination: {
        currentPage: page,
        totalPages,
        totalOrders,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit,
        status,
        search
      }
    };
  } catch (error) {
    console.log(`error from listOrder ${error}`);
    throw error;
  }
};

export const itemCancel = async (details, userId) => {
  try {
    const { orderId, itemIndex } = details;
    const order = await orderModal.findOne({ _id: orderId, userId });
    if (!order) throw new Error('Order not found');

    // Prevent cancellation on non-cancellable orders
    if (['delivered', 'returned', 'cancelled'].includes(order.orderStatus)) {
      throw new Error(`Cannot cancel items in a ${order.orderStatus} order`);
    }

    const itemsArray = [...order.items];
    if (itemIndex < 0 || itemIndex >= itemsArray.length) {
      throw new Error('Invalid item index');
    }

    const itemToCancel = itemsArray[itemIndex];
    if (itemToCancel.orderStatus === 'cancelled') {
      throw new Error('Item is already cancelled');
    }

    const originalDiscount = parseFloat(order.discountAmount);
    const totalItemsCount = itemsArray.length;
    
    const itemPrice = parseFloat(itemToCancel.price);
    const itemQuantity = itemToCancel.quantity;
    const itemTotalValue = itemPrice * itemQuantity;
    
    const discountPerItem = originalDiscount / totalItemsCount;
    const refundAmount = itemTotalValue - discountPerItem;

    itemsArray[itemIndex].orderStatus = 'cancelled';

    const activeItems = itemsArray.filter(item => item.orderStatus !== 'cancelled');
    const hasActiveItems = activeItems.length > 0;
    
    const newSubtotal = activeItems.reduce((sum, item) => {
      const price = parseFloat(item.price);
      return sum + (price * item.quantity);
    }, 0);

    const newDiscount = hasActiveItems ? (originalDiscount * (activeItems.length / totalItemsCount)) : 0;
    const newTax = 0;
    const newTotal = Math.max(0, newSubtotal - newDiscount + newTax);

    // Determine new order status
    let newOrderStatus = order.orderStatus;
    if (!hasActiveItems) {
      newOrderStatus = 'cancelled';
    }

    // Update payment status only if order becomes fully cancelled
    let updatedPaymentStatus = order.paymentStatus;
    if (!hasActiveItems && order.paymentStatus === 'paid') {
      updatedPaymentStatus = 'refunded';
    }

    const updatedOrder = await orderModal.findOneAndUpdate(
      { _id: orderId, userId },
      {
        $set: {
          items: itemsArray,
          subTotal: newSubtotal,
          discountAmount: newDiscount,
          taxAmount: newTax,
          totalAmount: newTotal,
          orderStatus: newOrderStatus,
          paymentStatus: updatedPaymentStatus
        }
      },
      { new: true }
    );

    if (!updatedOrder) throw new Error('Failed to update order');

    // Restore stock regardless of payment status
    await ProductVariant.findOneAndUpdate(
      { variantId: itemToCancel.variantId },
      { $inc: { stock: itemToCancel.quantity } },
      { new: true }
    );

    // Process refund ONLY for paid orders with valid refund amount
    const isPaidOrder = order.paymentStatus === 'paid';
    if (isPaidOrder && refundAmount > 0 && hasActiveItems) {
      const refundAmountDecimal = new mongoose.Types.Decimal128(refundAmount.toFixed(2));
      await refundToWallet(
        userId,
        refundAmountDecimal,
        orderId,
        `Refund for cancelled item: ${itemToCancel.productId} (Qty: ${itemQuantity})`
      );
    }

    // Full refund if entire order is cancelled
    if (isPaidOrder && !hasActiveItems && newTotal > 0) {
      const fullRefundAmount = new mongoose.Types.Decimal128(newTotal.toFixed(2));
      await refundToWallet(
        userId,
        fullRefundAmount,
        orderId,
        'Full order cancellation refund'
      );
    }

    return updatedOrder;
  } catch (error) {
    console.log(`error from itemCancel ${error}`);
    throw error;
  }
};

export const orderCancelEntire = async (orderId, userId) => {
  try {
    const order = await orderModal.findOne({ _id: orderId, userId });
    if (!order) {
      throw new Error('Order not found');
    }

    // Handle already cancelled orders
    if (order.orderStatus === 'cancelled') {
      return { success: true, message: 'Order already cancelled' };
    }

    // Prevent cancellation on non-cancellable orders
    if (['delivered', 'returned'].includes(order.orderStatus)) {
      throw new Error('Cannot cancel a delivered, returned, or return-requested order');
    }

    // Cancel all non-cancelled items and restore stock
    for (const item of order.items) {
      if (item.orderStatus !== 'cancelled') {
        const variant = await ProductVariant.findOne({ variantId: item.variantId });
        if (variant) {
          variant.stock += item.quantity;
          await variant.save();
          item.orderStatus = 'cancelled';
        }
      }
    }

    // Update order status
    order.orderStatus = 'cancelled';
    
    // Handle payment status based on original payment state
    if (order.paymentStatus === 'paid') {
      order.paymentStatus = 'refunded';
    } else {
      order.paymentStatus = 'failed';
    }
    
    await order.save();

    // Process refund ONLY for paid orders with amount > 0
    if (order.paymentStatus === 'refunded' && order.totalAmount > 0) {
      const refundAmount = new mongoose.Types.Decimal128(order.totalAmount.toFixed(2));
      await refundToWallet(
        userId,
        refundAmount,
        orderId,
        'Full order cancellation refund'
      );
    }

    return { 
      success: true, 
      message: order.paymentStatus === 'refunded' 
        ? 'Order cancelled successfully with full refund' 
        : 'Order cancelled successfully' 
    };
  } catch (error) {
    console.log(`error from orderCancelEntire ${error}`);
    throw error;
  }
};

export const productReturn = async (orderId, userId, reason) => {
  try {
    const order = await orderModal.findOne({ _id: orderId, userId });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.orderStatus !== 'delivered') {
      throw new Error('Only delivered orders can be returned');
    }

    if (['requestingReturn', 'returned'].includes(order.orderStatus)) {
      throw new Error('Return already requested or processed');
    }

    order.orderStatus = 'requestingReturn';
    order.returnReason = reason;
    order.returnRequestedAt = new Date();

    await order.save();
  } catch (error) {
    console.log(`error from productReturn ${error}`);
    throw error;
  }
};

export const returnItem = async (orderId, userId, reason, itemIndex) => {
  try {
    const order = await orderModal.findOne({_id: orderId, userId})

    if(!order) throw new Error("Order not found")

    if(order.orderStatus !== 'delivered') {
      throw new Error('Only delivered orders can be returned')
    }

    if(['requestingReturn', 'returned'].includes(order.items[itemIndex].orderStatus)) {
      throw new Error('Return already requested or processed')
    }

    order.items[itemIndex].orderStatus = 'requestingReturn'
    order.items[itemIndex].returnReason = reason
    order.items[itemIndex].returnRequestedAt = new Date()
    
    await order.save()
  } catch (error) {
    console.log(`error form returnItem ${error}`)
    throw error
  }
}