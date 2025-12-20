import addressCollection from "../../models/addressModel.js";
import Cart from "../../models/cartModel.js";
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import couponModel from "../../models/couponModel.js";
import orderModel from "../../models/orderModel.js";

export const tempOrder = async (userid, datas) => {
  try {
    const userId = new mongoose.Types.ObjectId(userid);
    const address = await addressCollection.findOne(
      { userId, addressId: datas.shippingAddressId },
      { _id: 0, fullName: 1, streetAddress: 1, phoneNumber: 1, city: 1, state: 1, postalCode: 1, country: 1 }
    );
    
    if (!address) throw new Error('Address not found');

    const items = await Cart.aggregate([
      { $match: { userId } },
      { $unwind: '$products' },
      {
        $lookup: {
          from: "productvariants",
          localField: "products.variantId",
          foreignField: "_id",
          as: "products.variant"
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: 'products.productId',
          foreignField: "_id",
          as: "products.product"
        }
      },
      {
        $addFields: {
          'products.product': { $arrayElemAt: ['$products.product', 0] },
          'products.variant': { $arrayElemAt: ['$products.variant', 0] }
        }
      },
      {
        $match: {
          "products.product": { $ne: null },
          "products.variant": { $ne: null },
          "products.product.isActive": true,
          "products.variant.isActive": true,
          "products.variant.stock": { $gt: 0 }
        }
      },
      {
        $project: {
          _id: 0,
          'products.productId': 1,
          'products.variantId': 1,
          'products.quantity': 1,
          'products.variant': 1,
          'products.product': 1
        }
      }
    ]);

    let productList = items.map(key => ({
      orderItemId: uuidv4(),
      productId: key.products.product.productId,
      productName: key.products.product.productName,
      variantId: key.products.variant.variantId,
      variantColor: key.products.variant.color,
      quantity: key.products.quantity,
      price: key.products.variant.price,
      images: key.products.variant.images
    }));

    if (productList.length === 0) throw new Error('No valid items in cart');

    const addressDetails = {
      fullName: address.fullName || '',
      streetAddress: address.streetAddress || '',
      phoneNumber: address.phoneNumber || '',
      secondNumber: datas.contact?.phone || '',
      email: datas.contact?.email || '',
      city: address.city || '',
      state: address.state || '',
      postalCode: address.postalCode || '',
      country: address.country || ''
    };

    return { productList, addressDetails };
  } catch (error) {
    console.error(`tempOrder error:`, error);
    throw error;
  }
};

export const couponDetails = async (filter = {}) => {
  if (filter.couponCode) {
    filter.couponCode = filter.couponCode.trim().toUpperCase();
  }
  return await couponModel.findOne({ isActive: true, ...filter });
};

export const getValidCouponsForUser = async (userId, subtotal) => {
  const now = new Date();
  const coupons = await couponModel.find({
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
    minAmount: { $lte: subtotal }
  });

  const valid = [];
  for (const coupon of coupons) {
    if (coupon.perUserLimit > 0) {
      const used = await orderModel.countDocuments({
        userId,
        'appliedCoupon.couponId': coupon.couponId
      });
      if (used < coupon.perUserLimit) {
        valid.push(coupon);
      }
    } else {
      valid.push(coupon);
    }
  }
  return valid;
};

