import { v4 as uuidv4 } from "uuid";
import Cart from "../../models/cartModel.js";
import { ProductVariant } from "../../models/productVariantModel.js";
import mongoose from 'mongoose';
import Offer from "../../models/offerModel.js";
import { applyOffersToProducts } from "../../util/offerUtils.js";
import logger from '../../util/logger.js'; // ✅ Add logger import

/**
 * Check inventory availability for a variant
 * @param {string} variantId - Product variant ID
 * @param {number} requestedQuantity - Requested quantity
 * @returns {Object} Inventory check result
 */
export const checkInventory = async (variantId, requestedQuantity) => {
    try {
        const variant = await ProductVariant.findById(variantId);
        
        if (!variant) {
            return {
                success: false,
                reason: 'variant_not_found',
                message: 'Product variant not found'
            };
        }
        
        if (!variant.isActive) {
            return {
                success: false,
                reason: 'variant_inactive',
                message: 'This product variant is not available'
            };
        }
        
        if (variant.stock <= 0) {
            return {
                success: false,
                reason: 'out_of_stock',
                availableStock: 0,
                message: 'Item is out of stock'
            };
        }
        
        if (requestedQuantity > variant.stock) {
            return {
                success: false,
                reason: 'insufficient_stock',
                availableStock: variant.stock,
                message: `Only ${variant.stock} items available in stock`
            };
        }
        
        // Check if requested quantity exceeds max per order
        const maxPerOrder = 10;
        if (requestedQuantity > maxPerOrder) {
            return {
                success: false,
                reason: 'max_per_order_exceeded',
                availableStock: variant.stock,
                maxPerOrder: maxPerOrder,
                message: `Maximum ${maxPerOrder} items per order allowed`
            };
        }
        
        return {
            success: true,
            availableStock: variant.stock,
            message: 'Inventory check passed'
        };
        
    } catch (error) {
        logger.error(`Error in inventory check: ${error.message}`);
        throw error;
    }
};

export const cartNew = async (cartItems, userId) => {
    try {
        const { productId, variantId, quantity } = cartItems;
        
        const inventoryCheck = await checkInventory(variantId, quantity);
        
        if (!inventoryCheck.success) {
            if (inventoryCheck.reason === 'out_of_stock' || inventoryCheck.reason === 'insufficient_stock') {
                return 'Insufficient stock';
            }
            
            if (inventoryCheck.reason === 'max_per_order_exceeded') {
                return 'Maximum limit reached in cart';
            }
            
            throw new Error(inventoryCheck.message || 'Inventory check failed');
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
        
        const existingItem = existingCart.products.find(
            p => p.variantId.toString() === variantId.toString()
        );
        
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
        logger.error(`Error in cartNew service: ${error.message}`);
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
        
        const itemsWithOffers = await applyOffersToProducts(cartItems, activeOffers);
        return itemsWithOffers;
    } catch (error) {
        logger.error(`Error in cartDetails service: ${error.message}`);
        throw error;
    }
};

export const cartUpdate = async (userId, cartItems) => {
    try {
        const { cartProductId, quantity } = cartItems;
        
        const cart = await Cart.findOne(
            { userId, 'products.cartProductId': cartProductId },
            { 'products.$': 1 }
        );
        
        if (!cart || !cart.products || cart.products.length === 0) {
            return { 
                success: false, 
                message: 'Cart item not found' 
            };
        }
        
        const cartItem = cart.products[0];
        const variantId = cartItem.variantId;
        
        const inventoryCheck = await checkInventory(variantId, quantity);
        
        if (!inventoryCheck.success) {
            if (inventoryCheck.reason === 'out_of_stock') {
                return {
                    success: false,
                    message: 'Item is out of stock',
                    reason: 'out_of_stock'
                };
            }
            
            if (inventoryCheck.reason === 'insufficient_stock') {
                return {
                    success: false,
                    message: `Only ${inventoryCheck.availableStock} items available in stock`,
                    reason: 'insufficient_stock',
                    availableStock: inventoryCheck.availableStock
                };
            }
            
            if (inventoryCheck.reason === 'max_per_order_exceeded') {
                return {
                    success: false,
                    message: `Maximum ${inventoryCheck.maxPerOrder} items per order allowed`,
                    reason: 'max_per_order_exceeded',
                    maxPerOrder: inventoryCheck.maxPerOrder
                };
            }
            
            return {
                success: false,
                message: inventoryCheck.message || 'Inventory check failed'
            };
        }
        
        const updatedCart = await Cart.findOneAndUpdate(
            { userId, 'products.cartProductId': cartProductId },
            { $set: { 'products.$.quantity': quantity } },
            { new: true, runValidators: true }
        );
        
        if (!updatedCart) {
            return { 
                success: false, 
                message: 'Failed to update cart item' 
            };
        }
        
        return { 
            success: true,
            availableStock: inventoryCheck.availableStock
        };
    } catch (error) {
        logger.error(`Error in cartUpdate service: ${error.message}`);
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
            return { success: false, message: 'Cart item not found' };
        }
        
        return { success: true };
    } catch (error) {
        logger.error(`Error in cartRemove service: ${error.message}`);
        throw error;
    }
};