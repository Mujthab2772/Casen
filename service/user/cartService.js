import { v4 as uuidv4 } from "uuid";
import Cart from "../../models/cartModel.js";
import mongoose from 'mongoose';

export const cartNew = async (cartItems, userId) => {
  try {
    const { productId, variantId, quantity } = cartItems;

    // Enforce: max 10 per variant per cart
    if (quantity > 10) {
      return "Maximum limit reached in cart";
    }

    const existingCart = await Cart.findOne({ userId });

    // Case 1: Cart doesn't exist → create new one
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

    // Case 2: Cart exists → check if variant already in cart
    const existingItem = existingCart.products.find(p => p.variantId.toString() === variantId.toString());

    if (existingItem) {
      // Variant exists → check total won't exceed 10
      if (existingItem.quantity + quantity > 10) {
        return "Maximum limit reached in cart";
      }

      // Update quantity
      await Cart.findOneAndUpdate(
        { userId, 'products.variantId': variantId },
        { $inc: { 'products.$.quantity': quantity } },
        { new: true }
      );
    } else {
      // Variant not in cart → add new product entry
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

    // Return updated cart
    return await Cart.findOne({ userId });

  } catch (error) {
    console.log(`error cartNew ${error}`);
    throw error;
  }
};

export const cartDetails = async (userid) => {
    try {
        const userId = new mongoose.Types.ObjectId(userid);

        const cartItems = await Cart.aggregate([
            { $match: { userId} },
            { $unwind: "$products" },
            {
                $lookup: {
                    from: "productvariants",     // ← lowercase plural!
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
                    'products.product': {$arrayElemAt: ['$products.product', 0]},
                    'products.variant': {$arrayElemAt: ['$products.variant', 0]}
                }
            },
            {
                $match: {
                    $and: [
                        { "products.product": { $ne: null } },        // product exists
                        { "products.variant": { $ne: null } },        // variant exists
                        { "products.product.isActive": { $ne: false } }, // product not blocked
                        { "products.variant.isActive": { $ne: false } },  // variant not blocked
                        { "products.variant.stock": {$ne : 0}}

                    ]
                }
            }
        ]);

        return cartItems
    } catch (error) {
        console.log(`error from cartDetails ${error}`);
        throw error
    }
}

export const 
cartUpdate = async (userId, cartItems) => {
    try {
        const {cartProductId, quantity } = cartItems


        const cartItem = await Cart.findOneAndUpdate(
            {userId, 'products.cartProductId': cartProductId}, 
            {$set: {'products.$.quantity': quantity}},
            {new: true, runValidators: true}
        )

        if(!cartItem) {
            return {success: false}
        }

        return {success: true}
    } catch (error) {
        console.log(`error from cartUpdate ${error}`);
        throw error
    }
}

export const cartRemove = async(cartProducts, userId) => {
    try {
        const { cartProductId } = cartProducts

        const cartItem = await Cart.findOneAndUpdate(
            {userId, 'products.cartProductId': cartProductId},
            {$pull: {products: {cartProductId: cartProductId}}},
            {new: true}
        )

        if(!cartItem) {
            return {success: false}
        }

        return {success: true}
    } catch (error) {
        console.log(`error from cartRemove ${error}`);
        throw error
        
    }
}