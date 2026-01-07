import addressCollection from "../../models/addressModel.js";
import Cart from "../../models/cartModel.js";
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import couponModel from "../../models/couponModel.js";
import orderModel from "../../models/orderModel.js";
import Offer from "../../models/offerModel.js";
import { applyOffersToProducts } from "../../util/offerUtils.js";

export const tempOrder = async (userId, datas) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const address = await addressCollection.findOne(
      { userId: userObjectId, addressId: datas.shippingAddressId },
      { _id: 0, fullName: 1, streetAddress: 1, phoneNumber: 1, city: 1, state: 1, postalCode: 1, country: 1 }
    );
    if (!address) throw new Error('Address not found');
    
    // Get active offers
    const today = new Date();
    const activeOffers = await Offer.find({
      status: 'active',
      startDate: { $lte: today },
      endDate: { $gte: today }
    }).lean();
    
    // Updated aggregation pipeline without problematic $project stage
    const items = await Cart.aggregate([
      { $match: { userId: userObjectId } },
      { $unwind: '$products' },
      {
        $lookup: {
          from: "productvariants",
          localField: "products.variantId",
          foreignField: "_id",
          as: "variantData"
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: 'products.productId',
          foreignField: "_id",
          as: "productData"
        }
      },
      {
        $addFields: {
          'products.variant': { $arrayElemAt: ['$variantData', 0] },
          'products.product': { $arrayElemAt: ['$productData', 0] }
        }
      },
      { $unset: ["variantData", "productData"] }, // Remove temporary fields
      {
        $lookup: {
          from: "categories",
          localField: "products.product.categoryId",
          foreignField: "_id",
          as: "categoryData"
        }
      },
      {
        $addFields: {
          'products.product.category': { $arrayElemAt: ['$categoryData', 0] }
        }
      },
      { $unset: ["categoryData"] }, // Remove temporary fields
      {
        $match: {
          "products.product": { $ne: null },
          "products.variant": { $ne: null },
          "products.product.isActive": true,
          "products.variant.isActive": true,
          "products.variant.stock": { $gt: 0 }
        }
      }
    ]);
    
    // Apply offers to all products
    const itemsWithOffers = await applyOffersToProducts(items, activeOffers);
    
    let productList = itemsWithOffers.map(item => ({
      orderItemId: uuidv4(),
      productId: item.products.product.productId,
      productName: item.products.product.productName,
      variantId: item.products.variant.variantId,
      variantColor: item.products.variant.color,
      quantity: item.products.quantity,
      price: item.products.variant.price, // This now has offers applied
      originalPrice: item.products.variant.originalPrice || item.products.variant.price,
      discountAmount: item.products.variant.originalPrice ? (item.products.variant.originalPrice - item.products.variant.price) : 0,
      hasOffer: item.products.variant.hasOffer || false,
      offerInfo: item.products.variant.offerInfo || null,
      images: item.products.variant.images
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
    
    // Calculate subtotal with offers already applied
    let subtotal = 0;
    productList.forEach(item => {
      subtotal += item.price * item.quantity;
    });
    
    return { 
      productList, 
      addressDetails,
      subtotal: parseFloat(subtotal.toFixed(2)),
      offersApplied: itemsWithOffers.some(item => item.products.variant.hasOffer)
    };
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
    minAmount: { $lte: subtotal } // Only return coupons valid for this subtotal
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

// Add this function to checkoutService.js
export const calculateFinalPrice = async (subtotal, couponCode = null, userId = null) => {
  let discount = 0;
  let appliedCoupon = null;
  
  if (couponCode) {
    const coupon = await couponDetails({ couponCode: couponCode.trim() });
    if (coupon && subtotal >= coupon.minAmount) {
      const now = new Date();
      if (now >= coupon.startDate && now <= coupon.endDate) {
        if (coupon.perUserLimit > 0 && userId) {
          const usage = await orderModel.countDocuments({
            userId,
            'appliedCoupon.couponId': coupon.couponId
          });
          
          if (usage < coupon.perUserLimit) {
            if (coupon.discountType === 'percentage') {
              const calc = (subtotal * coupon.discountAmount) / 100;
              discount = coupon.maxAmount ? Math.min(calc, coupon.maxAmount) : calc;
            } else {
              discount = coupon.discountAmount;
            }
            appliedCoupon = coupon;
          }
        } else {
          if (coupon.discountType === 'percentage') {
            const calc = (subtotal * coupon.discountAmount) / 100;
            discount = coupon.maxAmount ? Math.min(calc, coupon.maxAmount) : calc;
          } else {
            discount = coupon.discountAmount;
          }
          appliedCoupon = coupon;
        }
      }
    }
  }
  
  discount = Math.min(discount, subtotal);
  const tax = 0;
  const total = Math.max(0, subtotal - discount + tax);
  
  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    discount: parseFloat(discount.toFixed(2)),
    tax: parseFloat(tax.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
    appliedCoupon: appliedCoupon ? {
      couponId: appliedCoupon.couponId,
      couponCode: appliedCoupon.couponCode,
      discountType: appliedCoupon.discountType,
      discountAmount: parseFloat(discount.toFixed(2)),
      description: appliedCoupon.description
    } : null
  };
};