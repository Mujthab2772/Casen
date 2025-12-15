import { orderDetails, orderSingle, statusUpdate } from "../../service/admin/orderService.js";
import { STATUS_CODE } from "../../util/statusCodes.js";

export const orders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const status = req.query.status || "";

    const { orders, totalOrders } = await orderDetails({ skip, limit, search, status }); // ✅ Pass status

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

// controllers/admin/orderController.js
export const orderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const { userId } = req.query;

    if (!orderId || !status || !userId) {
      return res.status(STATUS_CODE.BAD_REQUEST).json({ success: false, message: 'Missing required fields' });
    }

    const result = await statusUpdate(orderId, status, userId);

    if (typeof result === 'string') {
      return res.status(STATUS_CODE.OK).json({ success: true, message: result, unchanged: true });
    }

    return res.status(STATUS_CODE.OK).json({ success: true, message: 'Order status updated successfully' });
  } catch (error) {
    console.error(`Error in orderStatus:`, error);
    return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failed to update order status' });
  }
};


