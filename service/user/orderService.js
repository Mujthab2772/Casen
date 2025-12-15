import orderModal from "../../models/orderModel.js"
import { ProductVariant } from "../../models/productVariantModel.js";
import mongoose from "mongoose";


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

    const itemsArray = order.items;
    if (itemIndex < 0 || itemIndex >= itemsArray.length) {
      throw new Error('Invalid item index');
    }

    const itemToCancel = itemsArray[itemIndex];

    if (itemToCancel.orderStatus === 'cancelled') {
      throw new Error('Item is already cancelled');
    }

    itemsArray[itemIndex].orderStatus = 'cancelled';

    const activeItems = itemsArray.filter(item => item.orderStatus !== 'cancelled');

    const newSubtotal = activeItems.reduce((sum, item) => {
      const price = item.price instanceof mongoose.Types.Decimal128
        ? item.price.toNumber()
        : item.price;
      return sum + (price * item.quantity);
    }, 0);

   
    const hasActiveItems = activeItems.length > 0;
    const newDiscount = hasActiveItems ? 40 : 0; 
    const newTax = 0;
    const newTotal = Math.max(0, newSubtotal - newDiscount + newTax);

    const updatedOrder = await orderModal.findOneAndUpdate(
      { _id: orderId, userId },
      {
        $set: {
          items: itemsArray,
          subTotal: newSubtotal,
          discountAmount: newDiscount,
          taxAmount: newTax,
          totalAmount: newTotal
        }
      },
      { new: true }
    );

    if (!updatedOrder) throw new Error('Failed to update order');

    await ProductVariant.findOneAndUpdate(
      { variantId: itemToCancel.variantId },
      { $inc: { stock: itemToCancel.quantity } },
      { new: true }
    );

    return updatedOrder;

  } catch (error) {
    console.log(`error from itemCancel ${error}`);
    throw error;
  }
};

export const orderCancelEntire = async (orderId, userId) => {
  try {
    const order = await orderModal.findOne({_id: orderId, userId})

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.orderStatus === 'cancelled') {
      return { success: true, message: 'Order already cancelled' };
    }

    if (['delivered', 'returned'].includes(order.orderStatus)) {
      throw new Error('Cannot cancel a delivered or returned order');
    }

    for (const item of order.items) {
      if (item.orderStatus !== 'cancelled') {
        const variant = await ProductVariant.findOne({ variantId: item.variantId });
        if (variant) {
          variant.stock += item.quantity;
          await variant.save();
          item.orderStatus = 'cancelled';
        } else {
          console.warn(`Variant not found for variantId: ${item.variantId}`);
        }
      }
    }

    order.orderStatus = 'cancelled';
    await order.save();

    return { success: true, message: 'Order cancelled successfully' };
  } catch (error) {
    console.log(`error from orderCancelEntire ${error}`);
    throw error
  }
}

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