import categoryModel from "../../models/categoryModel.js";
import { Product } from "../../models/productModel.js";
import Offer from "../../models/offerModel.js";
import userCollection from "../../models/userModel.js";
import logger from '../../util/logger.js'; // ✅ Add logger import

export const productDetailsFilter = async () => {
  try {
    const today = new Date();
    
    const activeOffers = await Offer.find({
      status: 'active',
      startDate: { $lte: today },
      endDate: { $gte: today }
    }).lean();

    const details = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $lookup: {
          from: "categories",
          localField: "categoryId",
          foreignField: "_id",
          as: "category"
        }
      },
      { $unwind: "$category" },
      { $match: { "category.isValid": true } },
      {
        $lookup: {
          from: "productvariants",
          localField: "variantId",
          foreignField: "_id",
          as: "variants"
        }
      },
      { $unwind: "$variants" },
      { $match: { "variants.isActive": true } },
      { $sort: { createdAt: -1 } }
    ]);

    return details.map(product => {
      return applyBestOfferToProduct(product, activeOffers);
    });
  } catch (error) {
    logger.error(`Error from landingpage Service product details: ${error.message}`);
    throw error;
  }
};

const applyBestOfferToProduct = (product, activeOffers) => {
  if (!product || !product.variants || !product.variants.price) {
    return product;
  }

  const productIdStr = product._id.toString();

  const productOffers = activeOffers.filter(offer => 
    offer.targetingType === 'products' && 
    offer.targeting.productIds.some(id => id.toString() === productIdStr)
  );

  const categoryIdStr = product.category._id.toString();
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
          : (best.discountValue / (product.variants.price || 1)) * 100;
          
        const currentValue = current.offerType === 'percentage' 
          ? current.discountValue 
          : (current.discountValue / (product.variants.price || 1)) * 100;
        
        return currentValue > bestValue ? current : best;
      }, null);
    }
  } else if (globalOffers.length > 0) {
    bestOffer = globalOffers[0];
  }

  if (bestOffer) {
    const originalPrice = parseFloat(product.variants.price.toString());
    let discountAmount = 0;
    let finalPrice = originalPrice;
    
    if (bestOffer.offerType === 'percentage') {
      discountAmount = (originalPrice * bestOffer.discountValue) / 100;
      finalPrice = originalPrice - discountAmount;
    } else if (bestOffer.offerType === 'fixed') {
      discountAmount = Math.min(bestOffer.discountValue, originalPrice);
      finalPrice = originalPrice - discountAmount;
    }

    product.offerInfo = {
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

    if (Array.isArray(product.variants)) {
      product.variants = product.variants.map(variant => {
        if (variant._id.toString() === product.variants._id.toString()) {
          return {
            ...variant,
            originalPrice: variant.price,
            price: finalPrice,
            hasOffer: true
          };
        }
        return variant;
      });
    } else {
      product.variants.originalPrice = product.variants.price;
      product.variants.price = finalPrice;
      product.variants.hasOffer = true;
    }
  }

  return product;
};

export const userDetail = async (useremail) => {
  try {
    let user = await userCollection.findOne({ email: useremail }, {
      _id: 1,
      userId: 1,
      firstName: 1,
      lastName: 1,
      email: 1,
      phoneNumber: 1,
      profilePic: 1,
      isActive: 1,
      password: 1,
      createdAt: 1,
      updatedAt: 1
    });
    
    if (!user) {
      return { status: "user is not found" };
    }
    return user;
  } catch (error) {
    logger.error(`Error from userDetail: ${error.message}`);
    throw error;
  }
};