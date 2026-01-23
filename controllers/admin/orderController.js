import {
    orderDetails,
    orderSingle,
    statusUpdate,
    itemStatusUpdate,
    orderReturnUpdate
} from "../../service/admin/orderService.js";
import { STATUS_CODE } from "../../util/statusCodes.js";
import logger from '../../util/logger.js';

/**
 * Admin Orders Controller
 * Handles all admin-related order operations
 */

/**
 * Get paginated list of orders with optional search and status filtering
 */
export const orders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;
        const search = req.query.search || "";
        const status = req.query.status || "";
        
        const { orders, totalOrders } = await orderDetails({ skip, limit, search, status });
        const totalPages = Math.ceil(totalOrders / limit);
        
        return res.render("orderManagement", {
            orders,
            currentPage: page,
            totalPages,
            totalOrders,
            search,
            status,
        });
    } catch (error) {
        logger.error(`Error fetching admin orders list: ${error.message}`);
        return res.redirect("/admin/products");
    }
};

/**
 * Get details of a single order
 */
export const singleOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await orderSingle(orderId);
        
        if (!order || order.length === 0) {
            logger.warn(`Single order view requested for non-existent ID: ${orderId}`);
            return res.status(STATUS_CODE.NOT_FOUND).send("Order not found");
        }
        
        return res.render("orderEdit", { order: order[0] });
    } catch (error) {
        logger.error(`Error loading single order (ID: ${req.params.orderId}): ${error.message}`);
        return res.redirect("/admin/orders");
    }
};

/**
 * Update the status of an entire order
 */
export const orderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;
        const { userId } = req.query;
        
        if (!orderId || !status || !userId) {
            logger.warn(`Order status update missing required fields: orderId=${orderId}, status=${status}, userId=${userId}`);
            return res.status(STATUS_CODE.BAD_REQUEST).json({
                success: false,
                message: 'Missing required fields'
            });
        }
        
        const result = await statusUpdate(orderId, status, userId);
        
        if (result.unchanged) {
            logger.info(`Order ${orderId} status unchanged: ${status}`);
            return res.status(STATUS_CODE.OK).json({
                success: true,
                message: result.message,
                unchanged: true
            });
        }
        
        // Auto-update item statuses when order is delivered
        if (status === 'delivered') {
            const order = result.order;
            for (const item of order.items) {
                if (item.orderStatus !== 'cancelled' && item.orderStatus !== 'returned') {
                    item.orderStatus = 'delivered';
                }
            }
            await order.save();
            logger.info(`Auto-updated all items in order ${orderId} to 'delivered'`);
        }
        
        const message = status === 'returned'
            ? 'Order returned successfully with refund processed'
            : 'Order status updated successfully';
            
        logger.info(`Order ${orderId} status updated to "${status}" by admin (user: ${userId})`);
        return res.status(STATUS_CODE.OK).json({ success: true, message });
    } catch (error) {
        logger.error(`Error updating order status for ${req.params.orderId}: ${error.message}`);
        return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: error.message || 'Failed to update order status'
        });
    }
};

/**
 * Update status of a specific item within an order
 */
export const itemStatus = async (req, res) => {
    try {
        const { orderId, orderItemId } = req.params;
        const { status } = req.body;
        const { userId } = req.query;
        
        if (!orderId || !orderItemId || !status || !userId) {
            logger.warn(`Item status update missing fields: orderId=${orderId}, itemId=${orderItemId}, status=${status}, userId=${userId}`);
            return res.status(STATUS_CODE.BAD_REQUEST).json({
                success: false,
                message: 'Missing required fields'
            });
        }
        
        if (status === 'requestingReturn') {
            logger.warn(`Admin attempted to set item status to 'requestingReturn' (not allowed)`);
            return res.status(STATUS_CODE.BAD_REQUEST).json({
                success: false,
                message: 'Admin cannot request returns. Only customers can initiate returns.'
            });
        }
        
        const result = await itemStatusUpdate(orderId, orderItemId, status, userId);
        
        if (result.unchanged) {
            logger.info(`Item ${orderItemId} in order ${orderId} status unchanged: ${status}`);
            return res.status(STATUS_CODE.OK).json({
                success: true,
                message: result.message,
                unchanged: true
            });
        }
        
        const message = status === 'cancelled'
            ? 'Item cancelled successfully with refund processed'
            : status === 'returned'
                ? 'Item returned successfully with refund processed'
                : 'Item status updated successfully';
                
        logger.info(`Item ${orderItemId} in order ${orderId} updated to "${status}" by admin (user: ${userId})`);
        return res.status(STATUS_CODE.OK).json({ success: true, message });
    } catch (error) {
        logger.error(`Error updating item status (order: ${req.params.orderId}, item: ${req.params.orderItemId}): ${error.message}`);
        return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: error.message || 'Failed to update item status'
        });
    }
};

/**
 * Handle admin approval/denial of return request for a specific item
 */
export const itemReturnStatus = async (req, res) => {
    try {
        const { orderId, orderItemId } = req.params;
        const { status } = req.body;
        const { userId } = req.query;
        
        if (!orderId || !orderItemId || !status || !userId) {
            logger.warn(`Item return approval missing fields: orderId=${orderId}, itemId=${orderItemId}, status=${status}`);
            return res.status(STATUS_CODE.BAD_REQUEST).json({
                success: false,
                message: 'Missing required fields'
            });
        }
        
        if (!['approved', 'denied'].includes(status)) {
            logger.warn(`Invalid return status "${status}" for item ${orderItemId}`);
            return res.status(STATUS_CODE.BAD_REQUEST).json({
                success: false,
                message: 'Invalid status. Only "approved" or "denied" allowed for item returns'
            });
        }
        
        const newStatus = status === 'approved' ? 'returned' : 'delivered';
        await itemStatusUpdate(orderId, orderItemId, newStatus, userId);
        
        const message = status === 'approved'
            ? 'Item return approved successfully with refund processed'
            : 'Item return denied successfully';
            
        logger.info(`Item return ${status} for item ${orderItemId} in order ${orderId} by admin (user: ${userId})`);
        return res.redirect(`/admin/order/${orderId}?success=${encodeURIComponent(message)}`);
    } catch (error) {
        logger.error(`Error in item return approval (order: ${req.params.orderId}, item: ${req.params.orderItemId}): ${error.message}`);
        return res.redirect(`/admin/order/${orderId}?error=${encodeURIComponent(error.message || 'Failed to update item return status')}`);
    }
};

/**
 * Handle admin approval/denial of return request for an entire order
 */
export const orderReturnStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;
        const { userId } = req.query;
        
        if (!orderId || !status || !userId) {
            logger.warn(`Order return approval missing fields: orderId=${orderId}, status=${status}`);
            return res.status(STATUS_CODE.BAD_REQUEST).json({
                success: false,
                message: 'Missing required fields'
            });
        }
        
        if (!['approved', 'denied'].includes(status)) {
            logger.warn(`Invalid order return status "${status}" for order ${orderId}`);
            return res.status(STATUS_CODE.BAD_REQUEST).json({
                success: false,
                message: 'Invalid status. Only "approved" or "denied" allowed for order returns'
            });
        }
        
        const newStatus = status === 'approved' ? 'returned' : 'delivered';
        await orderReturnUpdate(orderId, newStatus, userId);
        
        const message = status === 'approved'
            ? 'Full order return approved successfully with refund processed'
            : 'Full order return denied successfully';
            
        logger.info(`Full order return ${status} for order ${orderId} by admin (user: ${userId})`);
        return res.redirect(`/admin/order/${orderId}?success=${encodeURIComponent(message)}`);
    } catch (error) {
        logger.error(`Error in full order return approval (order: ${req.params.orderId}): ${error.message}`);
        return res.redirect(`/admin/order/${orderId}?error=${encodeURIComponent(error.message || 'Failed to update order return status')}`);
    }
};