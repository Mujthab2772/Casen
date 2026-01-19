import Wishlist from "../../models/wishlist.js";
import { v4 as uuidv4 } from "uuid";
import mongoose from "mongoose";
import Cart from "../../models/cartModel.js";
import logger from '../../util/logger.js'; // ✅ Add logger import

export const addWishlist = async (userid, details) => {
    try {
        const { productId, variantId } = details;
        const data = await Wishlist.findOne({ userId: userid, variantId });
        const cartitem = await Cart.findOne({ userId: userid, 'products.variantId': variantId });

        if (cartitem) return 'already in cart';

        if (data) return 'already in wishlist';

        const wishlist = new Wishlist({
            wishlistId: uuidv4(),
            userId: userid,
            productId,
            variantId
        });

        await wishlist.save();

        return 'success';
    } catch (error) {
        logger.error(`Error from addWishlist: ${error.message}`);
        if (error.code === 11000 || error.message.includes('duplicate key')) {
            return 'already in wishlist';
        }

        throw error;
    }
};

export const wishlistItems = async (userId, skip, limit) => {
  try {
    const userIdObj = new mongoose.Types.ObjectId(userId);
    const cartitem = await Cart.findOne({ userId });
    if (cartitem && cartitem?.products) {
      for (let key of cartitem.products) {
        await Wishlist.deleteOne({ variantId: key.variantId });
      }
    }

    const totalItems = await Wishlist.countDocuments({ userId: userIdObj });

    const items = await Wishlist.aggregate([
      { $match: { userId: userIdObj } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product'
        }
      },
      {
        $lookup: {
          from: 'productvariants',
          localField: 'variantId',
          foreignField: '_id',
          as: 'variant'
        }
      },
      {
        $addFields: {
          product: { $arrayElemAt: ['$product', 0] },
          variant: { $arrayElemAt: ['$variant', 0] }
        }
      },
      {
        $match: {
          'product._id': { $ne: null },
          'variant._id': { $ne: null }
        }
      }
    ]);

    return { items, totalItems };
  } catch (error) {
    logger.error(`Error from wishlistItems: ${error.message}`);
    throw error;
  }
};

export const removeWishlist = async (wishlistId) => {
  try {
    await Wishlist.findByIdAndDelete({ _id: wishlistId });

    return 'success';
  } catch (error) {
    logger.error(`Error from removeWishlist: ${error.message}`);
    throw error;
  }
};