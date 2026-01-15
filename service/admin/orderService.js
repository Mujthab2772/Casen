import mongoose from "mongoose";
import orderModal from "../../models/orderModel.js";
import { orderCancelEntire } from "../user/orderService.js";
import { ProductVariant } from "../../models/productVariantModel.js"; // Added import
import { Wallet } from "../../models/walletModel.js"; // Added import
import { Transaction } from "../../models/transactionsModel.js"; // Added import

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

export const orderDetails = async ({ skip, limit, search = "", status = "" }) => {
  try {
    let matchStage = {};

    if (search.trim() !== "") {
      const searchRegex = new RegExp(search.trim(), "i");
      matchStage.$or = [
        { "userDetails.firstName": searchRegex },
        { "userDetails.lastName": searchRegex },
        { "orderId": searchRegex }
      ];
    }

    if (status.trim() !== "") {
      matchStage.orderStatus = status.trim();
    }

    const countPipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      { $unwind: "$userDetails" },
      { $count: "total" },
    ];

    const countResult = await orderModal.aggregate(countPipeline);
    const totalOrders = countResult.length ? countResult[0].total : 0;

    const orders = await orderModal.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      { $unwind: "$userDetails" },
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    return { orders, totalOrders };
  } catch (error) {
    console.error(`Error in orderDetails service: ${error}`);
    throw error;
  }
};

export const orderSingle = async (orderId) => {
  try {
    return await orderModal.aggregate([
      {$match: { _id: new mongoose.Types.ObjectId(orderId) }},
      {$lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: "_id",
        as: "userDetails"
      }},
      {
        $unwind: '$userDetails'
      }
    ])
  } catch (error) {
    console.error(`Error from orderSingle: ${error}`);
    throw error;
  }
};

export const statusUpdate = async (orderId, status, userId) => {
  try {
    const order = await orderModal.findOne({ _id: orderId, userId });
    if (!order) {
      throw new Error('Order not found or unauthorized access');
    }

    if (order.orderStatus === status) {
      return { 
        message: 'Status unchanged', 
        currentStatus: order.orderStatus 
      };
    }

   if (status === 'cancelled') {
      return await orderCancelEntire(orderId, userId);
    }

    if (status === 'returned') {
      if (order.orderStatus !== 'requestingReturn') {
        throw new Error(`Invalid transition: ${order.orderStatus} → returned. Only 'requestingReturn' orders can be returned`);
      }

      for (const item of order.items) {
        if (item.orderStatus !== 'cancelled') {
          const variant = await ProductVariant.findOne({ variantId: item.variantId });
          if (!variant) continue;
          
          variant.stock += item.quantity;
          await variant.save();
          item.orderStatus = 'cancelled'; 
        }
      }

      order.orderStatus = 'returned';
      if (order.paymentStatus === 'paid') {
        order.paymentStatus = 'refunded';
      }

      await order.save();

      if (order.paymentStatus === 'refunded' && order.totalAmount > 0) {
        const refundAmount = new mongoose.Types.Decimal128(order.totalAmount.toFixed(2));
        await refundToWallet(
          userId,
          refundAmount,
          orderId,
          'Full order return refund'
        );
      }

      return order;
    }

    if (status === 'delivered') {
      if (order.paymentStatus !== 'paid') {
        order.paymentStatus = 'paid';
      }
    }

    order.orderStatus = status;
    await order.save();

    return order;
  } catch (error) {
    console.error(`[statusUpdate] Order ID: ${orderId} | Error: ${error.message}`, {
      stack: error.stack,
      userId,
      newStatus: status
    });
    throw new Error(`Status update failed: ${error.message}`);
  }
};