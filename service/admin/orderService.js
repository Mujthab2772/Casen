import mongoose from "mongoose";
import orderModal from "../../models/orderModel.js";
import { orderCancelEntire } from "../user/orderService.js";
import { ProductVariant } from "../../models/productVariantModel.js";
import { Wallet } from "../../models/walletModel.js";
import { Transaction } from "../../models/transactionsModel.js";

async function refundToWallet(userId, amount, orderId, description, orderItemId = null) {
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
      reference: { 
        orderId: orderId.toString(),
        ...(orderItemId && { orderItemId: orderItemId })
      }
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
      { $match: { _id: new mongoose.Types.ObjectId(orderId) } },
      { $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: "_id",
        as: "userDetails"
      }},
      { $unwind: '$userDetails' }
    ]);
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
        currentStatus: order.orderStatus,
        unchanged: true
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

export const itemStatusUpdate = async (orderId, orderItemId, status) => {
  try {
    const order = await orderModal.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    const item = order.items.find(i => i.orderItemId === orderItemId);
    if (!item) {
      throw new Error('Item not found in this order');
    }

    if (!['requestingReturn'].includes(item.orderStatus)) {
      throw new Error(`Invalid item status: ${item.orderStatus}. Only items with 'requestingReturn' status can be processed for return`);
    }

    if (status === 'approved' && item.orderStatus === 'returned') {
      return { 
        message: 'Item already returned', 
        unchanged: true 
      };
    }

    if (status === 'denied' && item.orderStatus === 'pending') {
      return { 
        message: 'Return already denied', 
        unchanged: true 
      };
    }

    if (status === 'approved') {
      const variant = await ProductVariant.findOne({ variantId: item.variantId });
      if (variant) {
        variant.stock += item.quantity;
        await variant.save();
      }

      const itemTotal = item.price * item.quantity;
      
      item.orderStatus = 'returned';
      item.returnApprovedAt = new Date();
      
      const allItemsReturnedOrCancelled = order.items.every(i => 
        ['returned', 'cancelled'].includes(i.orderStatus)
      );
      
      if (allItemsReturnedOrCancelled) {
        order.orderStatus = 'returned';
        
        const itemsWithRefund = order.items.filter(i => 
          i.orderStatus === 'returned'
        );
        
        if (itemsWithRefund.length > 0) {
          order.paymentStatus = 'refunded';
        }
      } else {
        const hasRequestingReturn = order.items.some(i => i.orderStatus === 'requestingReturn');
        if (!hasRequestingReturn) {
          if (order.orderStatus === 'requestingReturn') {
            const statusCounts = {};
            order.items.forEach(i => {
              statusCounts[i.orderStatus] = (statusCounts[i.orderStatus] || 0) + 1;
            });
            
            let mostCommonStatus = 'pending';
            let maxCount = 0;
            Object.entries(statusCounts).forEach(([s, count]) => {
              if (count > maxCount && s !== 'requestingReturn') {
                maxCount = count;
                mostCommonStatus = s;
              }
            });
            
            order.orderStatus = mostCommonStatus;
          }
        }
      }
      
      if (order.paymentStatus !== 'refunded' || !allItemsReturnedOrCancelled) {
        await refundToWallet(
          order.userId,
          new mongoose.Types.Decimal128(itemTotal.toFixed(2)),
          orderId,
          `Refund for returned item: ${item.productName}`,
          orderItemId
        );
      }
      
      await order.save();
      return { success: true, order, item };
    } 
    else if (status === 'denied') {
      item.orderStatus = 'delivered'; 
      item.returnReason = null; 
      item.returnRequestedAt = null; 
      
      const stillHasRequestingReturns = order.items.some(i => 
        i.orderStatus === 'requestingReturn' && i.orderItemId !== orderItemId
      );
      
      if (order.orderStatus === 'requestingReturn' && !stillHasRequestingReturns) {
        const statusCounts = {};
        order.items.forEach(i => {
          statusCounts[i.orderStatus] = (statusCounts[i.orderStatus] || 0) + 1;
        });
        
        let mostCommonStatus = 'pending';
        let maxCount = 0;
        Object.entries(statusCounts).forEach(([s, count]) => {
          if (count > maxCount) {
            maxCount = count;
            mostCommonStatus = s;
          }
        });
        
        order.orderStatus = mostCommonStatus;
      }
      
      await order.save();
      return { success: true, order, item };
    }
    
    throw new Error('Invalid status provided');
  } catch (error) {
    console.error(`[itemStatusUpdate] Order ID: ${orderId}, Order Item ID: ${orderItemId} | Error: ${error.message}`);
    throw new Error(`Item status update failed: ${error.message}`);
  }
};