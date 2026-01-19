import { 
  orderDetails, 
  orderSingle, 
  statusUpdate,
  itemStatusUpdate,
  orderReturnUpdate
} from "../../service/admin/orderService.js";
import { STATUS_CODE } from "../../util/statusCodes.js";

export const orders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const status = req.query.status || "";
    
    const { orders, totalOrders } = await orderDetails({ skip, limit, search, status });
    const totalPages = Math.ceil(totalOrders / limit);
    
    res.render("orderManagement", {
      orders,
      currentPage: page,
      totalPages,
      totalOrders,
      search,
      status,
    });
  } catch (error) {
    console.error(`Error in orders controller: ${error}`);
    res.redirect("/admin/products");
  }
};

export const singleOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await orderSingle(orderId);
    if (!order) return res.status(404).send("Order not found");
    res.render("orderEdit", { order: order[0] });
  } catch (error) {
    console.error(`Error from singleOrder: ${error}`);
    res.redirect("/admin/orders");
  }
};

export const orderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const { userId } = req.query;
    
    if (!orderId || !status || !userId) {
      return res.status(STATUS_CODE.BAD_REQUEST).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    const result = await statusUpdate(orderId, status, userId);
    if (result.unchanged) {
      return res.status(STATUS_CODE.OK).json({
        success: true,
        message: result.message,
        unchanged: true
      });
    }
    
    // When order is delivered, ensure all items are also delivered
    if (status === 'delivered') {
      const order = result.order;
      for (const item of order.items) {
        if (item.orderStatus !== 'cancelled' && item.orderStatus !== 'returned') {
          item.orderStatus = 'delivered';
        }
      }
      await order.save();
    }
    
    const message = status === 'returned'
      ? 'Order returned successfully with refund processed'
      : 'Order status updated successfully';
      
    return res.status(STATUS_CODE.OK).json({
      success: true,
      message
    });
  } catch (error) {
    console.error(`Error in orderStatus:`, error);
    return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || 'Failed to update order status'
    });
  }
};

// Controller for item status update
export const itemStatus = async (req, res) => {
  try {
    const { orderId, orderItemId } = req.params;
    const { status } = req.body;
    const { userId } = req.query;
    
    if (!orderId || !orderItemId || !status || !userId) {
      return res.status(STATUS_CODE.BAD_REQUEST).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    // Admin cannot request returns - only approve/deny them
    if (status === 'requestingReturn') {
      return res.status(STATUS_CODE.BAD_REQUEST).json({
        success: false,
        message: 'Admin cannot request returns. Only customers can initiate returns.'
      });
    }
    
    const result = await itemStatusUpdate(orderId, orderItemId, status, userId);
    
    if (result.unchanged) {
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
        
    return res.status(STATUS_CODE.OK).json({
      success: true,
      message
    });
  } catch (error) {
    console.error(`Error in itemStatus:`, error);
    return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || 'Failed to update item status'
    });
  }
};

export const itemReturnStatus = async (req, res) => {
  try {
    const { orderId, orderItemId } = req.params;
    const { status } = req.body;
    const { userId } = req.query;
    
    if (!orderId || !orderItemId || !status || !userId) {
      return res.status(STATUS_CODE.BAD_REQUEST).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    if (!['approved', 'denied'].includes(status)) {
      return res.status(STATUS_CODE.BAD_REQUEST).json({
        success: false,
        message: 'Invalid status. Only "approved" or "denied" allowed for item returns'
      });
    }
    
    // Convert approved/denied to proper status values
    const newStatus = status === 'approved' ? 'returned' : 'delivered';
    
    const result = await itemStatusUpdate(orderId, orderItemId, newStatus, userId);
    
    const message = status === 'approved'
      ? 'Item return approved successfully with refund processed'
      : 'Item return denied successfully';
      
    return res.redirect(`/admin/order/${orderId}?success=${encodeURIComponent(message)}`);
  } catch (error) {
    console.error(`Error in itemReturnStatus:`, error);
    return res.redirect(`/admin/order/${orderId}?error=${encodeURIComponent(error.message || 'Failed to update item return status')}`);
  }
};

// Controller for entire order return approval/denial
export const orderReturnStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const { userId } = req.query;
    
    if (!orderId || !status || !userId) {
      return res.status(STATUS_CODE.BAD_REQUEST).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    if (!['approved', 'denied'].includes(status)) {
      return res.status(STATUS_CODE.BAD_REQUEST).json({
        success: false,
        message: 'Invalid status. Only "approved" or "denied" allowed for order returns'
      });
    }
    
    // Convert approved/denied to proper status values
    const newStatus = status === 'approved' ? 'returned' : 'delivered';
    
    const result = await orderReturnUpdate(orderId, newStatus, userId);
    
    const message = status === 'approved'
      ? 'Full order return approved successfully with refund processed'
      : 'Full order return denied successfully';
      
    return res.redirect(`/admin/order/${orderId}?success=${encodeURIComponent(message)}`);
  } catch (error) {
    console.error(`Error in orderReturnStatus:`, error);
    return res.redirect(`/admin/order/${orderId}?error=${encodeURIComponent(error.message || 'Failed to update order return status')}`);
  }
};