import { v4 as uuidv4 } from "uuid";
import Cart from "../../models/cartModel.js";
import mongoose from 'mongoose';

export const cartNew = async (cartItems, userId) => {
    try {
        const { productId, variantId, quantity } = cartItems
        const cart = await Cart.findOne({userId})

        const produceItems = {
            cartProductId: uuidv4(),
            productId,
            variantId,
            quantity
        }

        const productItemsUpdate = await Cart.findOneAndUpdate(
            {userId, 'products.variantId': variantId},
            {$inc: {'products.$.quantity': quantity}},
            {new: true, runValidators: true}
        )

        if(productItemsUpdate) return productItemsUpdate

        const addProductsItems = await Cart.findOneAndUpdate(
            {userId},
            {$push: {products: produceItems}},
            {new: true, runValidators: true}
        )

        if(addProductsItems) return addProductsItems

        

        if(!cart) {
            const newCart = new Cart({
                cartId: uuidv4(),
                userId,
                products: [produceItems]
            })

            await newCart.save()
            return newCart
        }

    } catch (error) {
        console.log(`error cartNew ${error}`);
        throw error
    }
}

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
                        { "products.variant.isActive": { $ne: false } }  // variant not blocked

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

export const cartUpdate = async (userId, cartItems) => {
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