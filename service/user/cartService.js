import { v4 as uuidv4 } from "uuid";
import Cart from "../../models/cartModel.js";
import mongoose from 'mongoose';
import Offer from "../../models/offerModel.js";

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

const applyOfferToVariant = (variant, productIdStr, categoryIdStr, activeOffers, productName) => {
  if (!variant || !variant.price || variant.price <= 0) {
    return variant;
  }

  const originalPrice = parseFloat(variant.price.toString());

  const productOffers = activeOffers.filter(offer =>
    offer.targetingType === 'products' &&
    offer.targeting.productIds.some(id => id.toString() === productIdStr)
  );

  const categoryOffers = activeOffers.filter(offer =>
    offer.targetingType === 'categories' &&
    offer.targeting.categoryIds.some(id => id.toString() === categoryIdStr)
  );

  const globalOffers = activeOffers.filter(offer =>
    offer.targetingType === 'all'
  );

  let bestOffer = null;

  if (productOffers.length > 0 || categoryOffers.length > 0) {
    const specificOffers = [...productOffers, ...categoryOffers].filter(Boolean);
    if (specificOffers.length > 0) {
      bestOffer = specificOffers.reduce((best, current) => {
        if (!best) return current;
        
        const bestValue = best.offerType === 'percentage'
          ? best.discountValue
          : (best.discountValue / originalPrice) * 100;
          
        const currentValue = current.offerType === 'percentage'
          ? current.discountValue
          : (current.discountValue / originalPrice) * 100;
          
        return currentValue > bestValue ? current : best;
      }, null);
    }
  } 
  else if (globalOffers.length > 0) {
    bestOffer = globalOffers[0];
  }

  const updatedVariant = { ...variant, originalPrice: originalPrice };
  
  if (bestOffer) {
    let discountAmount = 0;
    let finalPrice = originalPrice;

    if (bestOffer.offerType === 'percentage') {
      discountAmount = (originalPrice * bestOffer.discountValue) / 100;
      finalPrice = originalPrice - discountAmount;
    } else if (bestOffer.offerType === 'fixed') {
      discountAmount = Math.min(bestOffer.discountValue, originalPrice);
      finalPrice = originalPrice - discountAmount;
    }

    finalPrice = Math.max(0, finalPrice);

    updatedVariant.offerInfo = {
      offerId: bestOffer._id.toString(),
      offerName: bestOffer.offerName,
      offerType: bestOffer.offerType,
      discountValue: bestOffer.discountValue,
      discountPercentage: bestOffer.offerType === 'percentage'
        ? bestOffer.discountValue
        : (discountAmount / originalPrice) * 100,
      originalPrice: originalPrice,
      discountAmount: discountAmount,
      finalPrice: finalPrice
    };

    updatedVariant.originalPrice = originalPrice;
    updatedVariant.price = finalPrice;
    updatedVariant.hasOffer = true;
  }

  return updatedVariant;
};

export const cartDetails = async (userid) => {
  try {
    const userId = new mongoose.Types.ObjectId(userid);
    const today = new Date();
    
    const activeOffers = await Offer.find({
      status: 'active',
      startDate: { $lte: today },
      endDate: { $gte: today }
    }).lean();
    
    const cartItems = await Cart.aggregate([
      { $match: { userId } },
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
    
    for (const item of cartItems) {
      if (item.products && item.products.variant && item.products.product) {
        const productIdStr = item.products.product._id.toString();
        const categoryIdStr = item.products.product.categoryId ? item.products.product.categoryId.toString() : '';
        
        item.products.variant = applyOfferToVariant(
          item.products.variant, 
          productIdStr, 
          categoryIdStr, 
          activeOffers, 
          item.products.product.productName
        );
        
        item.products.total = (item.products.variant.price * item.products.quantity).toFixed(2);
      }
    }
    
    return cartItems;
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