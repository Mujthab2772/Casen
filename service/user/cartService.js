import { v4 as uuidv4 } from "uuid";
import Cart from "../../models/cartModel.js";
import mongoose from 'mongoose';
import Offer from "../../models/offerModel.js";
import { applyOffersToProducts } from "../../util/offerUtils.js";

export const cartNew = async (cartItems, userId) => {
  try {
    const { productId, variantId, quantity } = cartItems;
    if (quantity > 10) {
      return "Maximum limit reached in cart";
    }
    const existingCart = await Cart.findOne({ userId });
    if (!existingCart) {
      const newCart = new Cart({
        cartId: uuidv4(),
        userId,
        products: [{
          cartProductId: uuidv4(),
          productId,
          variantId,
          quantity
        }]
      });
      await newCart.save();
      return newCart;
    }
    const existingItem = existingCart.products.find(p => p.variantId.toString() === variantId.toString());
    if (existingItem) {
      if (existingItem.quantity + quantity > 10) {
        return "Maximum limit reached in cart";
      }
      await Cart.findOneAndUpdate(
        { userId, 'products.variantId': variantId },
        { $inc: { 'products.$.quantity': quantity } },
        { new: true }
      );
    } else {
      await Cart.findOneAndUpdate(
        { userId },
        {
          $push: {
            products: {
              cartProductId: uuidv4(),
              productId,
              variantId,
              quantity
            }
          }
        }
      );
    }
    return await Cart.findOne({ userId });
  } catch (error) {
    console.log(`error cartNew ${error}`);
    throw error;
  }
};

export const cartDetails = async (userId) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const today = new Date();
    const activeOffers = await Offer.find({
      status: 'active',
      startDate: { $lte: today },
      endDate: { $gte: today }
    }).lean();
    
    const cartItems = await Cart.aggregate([
      { $match: { userId: userObjectId } },
      { $unwind: "$products" },
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
        $lookup: {
          from: "categories",
          localField: "products.product.categoryId",
          foreignField: "_id",
          as: "products.product.category"
        }
      },
      {
        $addFields: {
          'products.product.category': { $arrayElemAt: ['$products.product.category', 0] }
        }
      },
      {
        $match: {
          $and: [
            { "products.product": { $ne: null } },
            { "products.variant": { $ne: null } },
            { "products.product.isActive": { $ne: false } },
            { "products.variant.isActive": { $ne: false } },
            { "products.variant.stock": { $ne: 0 } }
          ]
        }
      }
    ]);
    
    // Apply offers and calculate totals
    const itemsWithOffers = await applyOffersToProducts(cartItems, activeOffers);
    
    return itemsWithOffers;
  } catch (error) {
    console.log(`error from cartDetails ${error}`);
    throw error;
  }
};

export const cartUpdate = async (userId, cartItems) => {
  try {
    const { cartProductId, quantity } = cartItems;
    const cartItem = await Cart.findOneAndUpdate(
      { userId, 'products.cartProductId': cartProductId },
      { $set: { 'products.$.quantity': quantity } },
      { new: true, runValidators: true }
    );
    if (!cartItem) {
      return { success: false };
    }
    return { success: true };
  } catch (error) {
    console.log(`error from cartUpdate ${error}`);
    throw error;
  }
};

export const cartRemove = async (cartProducts, userId) => {
  try {
    const { cartProductId } = cartProducts;
    const cartItem = await Cart.findOneAndUpdate(
      { userId, 'products.cartProductId': cartProductId },
      { $pull: { products: { cartProductId: cartProductId } } },
      { new: true }
    );
    if (!cartItem) {
      return { success: false };
    }
    return { success: true };
  } catch (error) {
    console.log(`error from cartRemove ${error}`);
    throw error;
  }
};