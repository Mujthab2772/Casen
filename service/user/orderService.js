import orderModal from "../../models/orderModel.js"
import { ProductVariant } from "../../models/productVariantModel.js";
import mongoose from "mongoose";

export const listOrder = async (userId) => {
    try {
        const orderDatas = await orderModal.find({userId})

        return orderDatas
    } catch (error) {
        console.log(`error from listOrder ${error}`);
        throw error
    }
}

export const itemCancel = async (details, userId) => {
  try {
    const { orderId, itemIndex } = details;

    const order = await orderModal.findOne({ _id: orderId, userId });
    if (!order) throw new Error('Order not found');

    const itemsArray = order.items;
    if (itemIndex < 0 || itemIndex >= itemsArray.length) {
      throw new Error('Invalid item index');
    }

    const itemToRemove = itemsArray[itemIndex];
    const { price, quantity } = itemToRemove;

    const itemPrice = price instanceof mongoose.Types.Decimal128
      ? price.toNumber()
      : price;

    const amountToRemove = itemPrice * quantity;

    const updatedOrder = await orderModal.findOneAndUpdate(
      { _id: orderId, userId },
      {
        $pull: { items: { orderItemId: itemToRemove.orderItemId } },
        $inc: {
          subTotal: -amountToRemove,
          totalAmount: -amountToRemove 
        }
      },
      { new: true }
    );

    if (!updatedOrder) throw new Error('Failed to update order');

    await ProductVariant.findOneAndUpdate(
      { variantId: itemToRemove.variantId },
      { $inc: { stock: quantity } },
      { new: true }
    );

    return updatedOrder;

  } catch (error) {
    console.log(`error from itemCancel ${error}`);
    throw error;
  }
};