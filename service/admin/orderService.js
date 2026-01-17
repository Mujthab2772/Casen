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

// New function to handle single item status updates for returns
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

    // Validate current item status
    if (!['requestingReturn'].includes(item.orderStatus)) {
      throw new Error(`Invalid item status: ${item.orderStatus}. Only items with 'requestingReturn' status can be processed for return`);
    }

    // Check if status is unchanged
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

    // Process approved return
    if (status === 'approved') {
      // Find the variant and update stock
      const variant = await ProductVariant.findOne({ variantId: item.variantId });
      if (variant) {
        variant.stock += item.quantity;
        await variant.save();
      }

      // Calculate refund amount for this item
      const itemTotal = item.price * item.quantity;
      
      // Update item status
      item.orderStatus = 'returned';
      item.returnApprovedAt = new Date();
      
      // Check if all items are returned or cancelled
      const allItemsReturnedOrCancelled = order.items.every(i => 
        ['returned', 'cancelled'].includes(i.orderStatus)
      );
      
      // Update order status if all items are returned/cancelled
      if (allItemsReturnedOrCancelled) {
        order.orderStatus = 'returned';
        
        // Check if any items were not refunded (cancelled without refund)
        const itemsWithRefund = order.items.filter(i => 
          i.orderStatus === 'returned'
        );
        
        if (itemsWithRefund.length > 0) {
          order.paymentStatus = 'refunded';
        }
      } else {
        // If not all items are returned, check if we need to update order status
        const hasRequestingReturn = order.items.some(i => i.orderStatus === 'requestingReturn');
        if (!hasRequestingReturn) {
          // No more items requesting return, but not all are returned/cancelled
          if (order.orderStatus === 'requestingReturn') {
            // Determine the most common status among items
            const statusCounts = {};
            order.items.forEach(i => {
              statusCounts[i.orderStatus] = (statusCounts[i.orderStatus] || 0) + 1;
            });
            
            // Set order status to the most common item status
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
      
      // Process refund for this item
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
    // Process denied return
    else if (status === 'denied') {
      item.orderStatus = 'delivered'; // Reset to pending status
      item.returnReason = null; // Clear return reason
      item.returnRequestedAt = null; // Clear request timestamp
      
      // Check if any other items are still requesting return
      const stillHasRequestingReturns = order.items.some(i => 
        i.orderStatus === 'requestingReturn' && i.orderItemId !== orderItemId
      );
      
      // Update order status if needed
      if (order.orderStatus === 'requestingReturn' && !stillHasRequestingReturns) {
        // Determine the most common status among items
        const statusCounts = {};
        order.items.forEach(i => {
          statusCounts[i.orderStatus] = (statusCounts[i.orderStatus] || 0) + 1;
        });
        
        // Set order status to the most common item status
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