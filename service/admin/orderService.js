import mongoose from "mongoose";
import orderModel from "../../models/orderModel.js";
import { orderCancelEntire } from "../user/orderService.js";
import { ProductVariant } from "../../models/productVariantModel.js";
import { Wallet } from "../../models/walletModel.js";
import { Transaction } from "../../models/transactionsModel.js";
import logger from '../../util/logger.js';

/**
 * Process refund to customer's wallet
 * @param {String} userId - ID of the user to refund
 * @param {Number} amount - Refund amount
 * @param {String} orderId - Order ID for reference
 * @param {String} description - Description for the transaction
 * @param {String} orderItemId - Optional item ID if refund is for a specific item
 */
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
        logger.error(`Wallet refund failed: ${error.message}`);
        throw new Error('Failed to process wallet refund');
    }
}

/**
 * Validate status transitions for orders and items
 * @param {String} currentStatus - Current status of the order/item
 * @param {String} newStatus - New status to transition to
 * @param {Boolean} isItem - Whether this is for an item (true) or order (false)
 * @returns {Boolean} - Whether the transition is valid
 */
function validateStatusTransition(currentStatus, newStatus, isItem = false) {
    // Define valid status transitions
    const validTransitions = {
        'pending': ['confirmed', 'cancelled'],
        'confirmed': ['processing', 'cancelled'],
        'processing': ['shipped', 'cancelled'],
        'shipped': ['delivered'], // Cannot cancel after shipping
        'delivered': ['requestingReturn'],
        'requestingReturn': ['returned', 'delivered'],
        'cancelled': [],
        'returned': []
    };
    
    // Admin cannot request returns
    if (isItem && newStatus === 'requestingReturn') {
        throw new Error('Admin cannot request returns. Only customers can initiate returns.');
    }
    
    // Check if the new status is in the valid transitions for the current status
    return validTransitions[currentStatus]?.includes(newStatus) || false;
}

/**
 * Get paginated list of orders with optional search and status filtering
 */
export const orderDetails = async ({ skip, limit, search = "", status = "" }) => {
    try {
        let matchStage = {};
        
        // Apply search filter if provided
        if (search.trim() !== "") {
            const searchRegex = new RegExp(search.trim(), "i");
            matchStage.$or = [
                { "userDetails.firstName": searchRegex },
                { "userDetails.lastName": searchRegex },
                { "orderId": searchRegex }
            ];
        }
        
        // Apply status filter if provided
        if (status.trim() !== "") {
            matchStage.orderStatus = status.trim();
        }
        
        // Count pipeline for total orders
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
        
        const countResult = await orderModel.aggregate(countPipeline);
        const totalOrders = countResult.length ? countResult[0].total : 0;
        
        // Get orders with pagination
        const orders = await orderModel.aggregate([
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
        logger.error(`Error in orderDetails service: ${error.message}`);
        throw error;
    }
};

/**
 * Get a single order by ID
 */
export const orderSingle = async (orderId) => {
    try {
        return await orderModel.aggregate([
            { $match: { _id: new mongoose.Types.ObjectId(orderId) } },
            { 
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: "_id",
                    as: "userDetails"
                }
            },
            { $unwind: '$userDetails' }
        ]);
    } catch (error) {
        logger.error(`Error from orderSingle: ${error.message}`);
        throw error;
    }
};

/**
 * Update order status
 */
export const statusUpdate = async (orderId, status, userId) => {
    try {
        const order = await orderModel.findOne({ _id: orderId, userId });
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
        
        // Admin cannot request returns for entire orders
        if (status === 'requestingReturn') {
            throw new Error('Admin cannot request returns. Only customers can initiate returns.');
        }
        
        // Validate status transition
        if (!validateStatusTransition(order.orderStatus, status)) {
            throw new Error(`Invalid status transition from ${order.orderStatus} to ${status}`);
        }
        
        // Handle cancellation - only allowed before delivery
        if (status === 'cancelled') {
            // Ensure we cannot cancel delivered orders
            if (order.orderStatus === 'delivered') {
                throw new Error('Cannot cancel an order that has already been delivered');
            }
            
            return await orderCancelEntire(orderId, userId);
        }
        
        // Handle returns - only allowed from requestingReturn status
        if (status === 'returned' && order.orderStatus !== 'requestingReturn') {
            throw new Error(`Invalid transition: ${order.orderStatus} → returned. Only 'requestingReturn' orders can be returned`);
        }
        
        // Handle delivery - update payment status if needed
        if (status === 'delivered') {
            if (order.paymentStatus !== 'paid') {
                order.paymentStatus = 'paid';
            }
            
            // When order is delivered, ensure all items are also delivered
            for (const item of order.items) {
                if (item.orderStatus !== 'cancelled' && item.orderStatus !== 'returned') {
                    item.orderStatus = 'delivered';
                }
            }
        }
        
        // Update order status
        order.orderStatus = status;
        await order.save();
        
        return { success: true, order };
    } catch (error) {
        logger.error(`[statusUpdate] Order ID: ${orderId} | Error: ${error.message}`, {
            stack: error.stack,
            userId,
            newStatus: status
        });
        throw new Error(`Status update failed: ${error.message}`);
    }
};

/**
 * Update status of an individual item within an order
 */
export const itemStatusUpdate = async (orderId, orderItemId, status, userId) => {
    try {
        const order = await orderModel.findOne({ _id: orderId, userId });
        if (!order) {
            throw new Error('Order not found or unauthorized access');
        }
        
        const item = order.items.find(i => i.orderItemId === orderItemId);
        if (!item) {
            throw new Error('Item not found in this order');
        }
        
        if (item.orderStatus === status) {
            return {
                message: 'Status unchanged',
                currentStatus: item.orderStatus,
                unchanged: true
            };
        }
        
        // Admin cannot request returns - only approve/deny them
        if (status === 'requestingReturn') {
            throw new Error('Admin cannot request returns. Only customers can initiate returns.');
        }
        
        // Validate status transition
        if (!validateStatusTransition(item.orderStatus, status, true)) {
            throw new Error(`Invalid item status transition from ${item.orderStatus} to ${status}`);
        }
        
        // Special handling for cancellations and returns
        if (status === 'cancelled' || status === 'returned') {
            // Update inventory
            const variant = await ProductVariant.findOne({ variantId: item.variantId });
            if (variant) {
                variant.stock += item.quantity;
                await variant.save();
            }
            
            // Process refund if needed
            if (order.paymentStatus === 'paid' && ['cancelled', 'returned'].includes(status)) {
                const itemTotal = item.price * item.quantity;
                await refundToWallet(
                    userId,
                    new mongoose.Types.Decimal128(itemTotal.toFixed(2)),
                    orderId,
                    `${status === 'cancelled' ? 'Cancellation' : 'Return'} refund for item: ${item.productName}`,
                    orderItemId
                );
            }
        }
        
        // Update item status
        item.orderStatus = status;
        
        // Update order status based on item statuses
        const allItemsSameStatus = order.items.every(i => i.orderStatus === status);
        const allItemsCancelledOrReturned = order.items.every(i =>
            ['cancelled', 'returned'].includes(i.orderStatus)
        );
        const hasRequestingReturn = order.items.some(i => i.orderStatus === 'requestingReturn');
        
        if (allItemsSameStatus) {
            order.orderStatus = status;
        } else if (allItemsCancelledOrReturned) {
            order.orderStatus = 'cancelled';
            order.paymentStatus = 'refunded';
        } else if (hasRequestingReturn && order.orderStatus !== 'requestingReturn') {
            order.orderStatus = 'requestingReturn';
        } else if (!hasRequestingReturn && order.orderStatus === 'requestingReturn') {
            // Find the most common status among items
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
    } catch (error) {
        logger.error(`[itemStatusUpdate] Order ID: ${orderId}, Order Item ID: ${orderItemId} | Error: ${error.message}`);
        throw new Error(`Item status update failed: ${error.message}`);
    }
};

/**
 * Process return approval/denial for an entire order
 */
export const orderReturnUpdate = async (orderId, status, userId) => {
    try {
        const order = await orderModel.findOne({ _id: orderId, userId });
        if (!order) {
            throw new Error('Order not found or unauthorized access');
        }
        
        if (order.orderStatus !== 'requestingReturn') {
            throw new Error(`Invalid order status for return processing. Order must be in 'requestingReturn' status`);
        }
        
        if (order.orderStatus === status) {
            return {
                message: 'Status unchanged',
                currentStatus: order.orderStatus,
                unchanged: true
            };
        }
        
        // Handle full order return approval
        if (status === 'returned') {
            // Process each item
            for (const item of order.items) {
                if (item.orderStatus !== 'cancelled' && item.orderStatus !== 'returned') {
                    // Update inventory
                    const variant = await ProductVariant.findOne({ variantId: item.variantId });
                    if (variant) {
                        variant.stock += item.quantity;
                        await variant.save();
                    }
                    item.orderStatus = 'returned';
                }
            }
            
            // Process refund
            if (order.paymentStatus === 'paid' && order.totalAmount > 0) {
                const refundAmount = new mongoose.Types.Decimal128(order.totalAmount.toFixed(2));
                await refundToWallet(
                    userId,
                    refundAmount,
                    orderId,
                    'Full order return refund'
                );
                order.paymentStatus = 'refunded';
            }
        }
        // Handle return denial
        else if (status === 'delivered') {
            // Reset items that were requesting return
            order.items.forEach(item => {
                if (item.orderStatus === 'requestingReturn') {
                    item.orderStatus = 'delivered';
                    item.returnReason = null;
                    item.returnRequestedAt = null;
                }
            });
        }
        
        order.orderStatus = status;
        order.returnApprovedAt = status === 'returned' ? new Date() : null;
        await order.save();
        
        return { success: true, order };
    } catch (error) {
        logger.error(`[orderReturnUpdate] Order ID: ${orderId} | Error: ${error.message}`);
        throw new Error(`Order return processing failed: ${error.message}`);
    }
};