import mongoose from "mongoose";
import orderModal from "../../models/orderModel.js"
import { orderCancelEntire } from "../user/orderService.js";

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
    if (!order) throw new Error('Order not found');

    if (order.orderStatus === status) {
      return 'Current status and update are the same';
    }

    if (status === 'cancelled') {
      return await orderCancelEntire(orderId, userId);
    }

    if (status === 'returned') {
      await orderCancelEntire(orderId, userId);
      order.orderStatus = 'returned';
      await order.save();
      return order;
    }

    order.orderStatus = status;
    await order.save();
    return order;
  } catch (error) {
    console.log(`error from statusUpdate ${error}`);
    throw error
  }
};