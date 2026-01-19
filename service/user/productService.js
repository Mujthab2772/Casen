import categoryModel from "../../models/categoryModel.js";
import { Product } from "../../models/productModel.js";
import Offer from "../../models/offerModel.js";
import logger from '../../util/logger.js'; // ✅ Add logger import

export const productDetails = async ({
    search = '',
    sort = 'bestselling',
    minPrice,
    maxPrice,
    category,
    product,
    color,
    page = 1,
    limit = 10
}) => {
    try {
        const pipeline = [];
        const today = new Date();
        
        const activeOffers = await Offer.find({
            status: 'active',
            startDate: { $lte: today },
            endDate: { $gte: today }
        }).lean();
        
        
        let searchString = '';
        if (typeof search === 'string') {
            searchString = search.trim();
        } else if (Array.isArray(search)) {
            searchString = search[0] ? search[0].trim() : '';
        }
        
        const matchStage = { isActive: true };
        if (searchString) {
            matchStage.productName = { $regex: searchString, $options: 'i' };
        }
        pipeline.push({ $match: matchStage });
        
        
        pipeline.push({
            $lookup: {
                from: "categories",
                localField: "categoryId",
                foreignField: "_id",
                as: "category"
            }
        });
        pipeline.push({ $unwind: "$category" });
        pipeline.push({ $match: { "category.isValid": true } });
        pipeline.push({
            $lookup: {
                from: "productvariants",
                localField: "variantId",
                foreignField: "_id",
                as: "variants"
            }
        });
        pipeline.push({ $unwind: "$variants" });
        pipeline.push({
            $addFields: {
                "variants.price": { $toDouble: "$variants.price" }
            }
        });
        pipeline.push({ $match: { "variants.isActive": true } });
        
        
        if (category) {
            const cats = (typeof category === 'string' ? category.split(',') : [])
                .map(c => c.trim())
                .filter(c => c);
            if (cats.length > 0) {
                pipeline.push({ $match: { "category.categoryName": { $in: cats } } });
            }
        }
        
        
        if (product) {
            const prods = (typeof product === 'string' ? product.split(',') : [])
                .map(p => p.trim())
                .filter(p => p);
            if (prods.length > 0) {
                pipeline.push({ $match: { productName: { $in: prods } } });
            }
        }
        
        
        if (minPrice !== undefined || maxPrice !== undefined) {
            const priceMatch = {};
            if (minPrice != null) priceMatch.$gte = parseFloat(minPrice);
            if (maxPrice != null) priceMatch.$lte = parseFloat(maxPrice);
            if (Object.keys(priceMatch).length > 0) {
                pipeline.push({ $match: { "variants.price": priceMatch } });
            }
        }
        
        if(color) {
            const colorRegex = new RegExp(color.trim(), 'i')
            pipeline.push({$match: {"variants.color": colorRegex}})
        }
        
        
        const sortMap = {
            priceLowToHigh: { "variants.price": 1 },
            priceHighToLow: { "variants.price": -1 },
            'aA-zZ': { productName: 1 },
            'zZ-aA': { productName: -1 },
            newest: { createdAt: -1 }
        };
        const sortStage = sortMap[sort] || { createdAt: -1 };
        pipeline.push({ $sort: sortStage });
        
        
        const skip = (page - 1) * limit;
        pipeline.push({ $skip: skip }, { $limit: limit });
        
        const data = await Product.aggregate(pipeline);
        
        
        const dataWithOffers = data.map(item => {
            return applyBestOfferToProduct(item, activeOffers);
        });
        
        
        const countPipeline = pipeline
            .filter(s => !s.$skip && !s.$limit && !s.$sort)
            .concat({ $count: "total" });
        const countRes = await Product.aggregate(countPipeline);
        const total = countRes.length ? countRes[0].total : 0;
        
        const allCategories = await categoryModel.find({isValid: true}, {categoryName: 1}).lean();
        const allproducts = await Product.distinct('productName', {isActive: true});
        
        return {
            data: dataWithOffers,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                total,
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            },
            allCategories,
            allproducts
        };
    } catch (error) {
        logger.error(`[productDetails] Error: ${error.message}`, error);
        throw error;
    }
};


const applyBestOfferToProduct = (product, activeOffers) => {
    if (!product || !product.variants) {
        return product;
    }

    
    const productIdStr = product._id.toString();
    
    
    const categoryIdStr = product.category?._id?.toString() || '';

    
    if (Array.isArray(product.variants)) {
        return {
            ...product,
            variants: product.variants.map(variant => applyOfferToVariant(variant, productIdStr, categoryIdStr, activeOffers, product.productName))
        };
    } 
    
    else {
        const updatedVariant = applyOfferToVariant(product.variants, productIdStr, categoryIdStr, activeOffers, product.productName);
        return {
            ...product,
            variants: updatedVariant,
            offerInfo: updatedVariant.offerInfo
        };
    }
};


const applyOfferToVariant = (variant, productIdStr, categoryIdStr, activeOffers, productName) => {
    if (!variant || !variant.price || variant.price <= 0) {
        return variant;
    }

    const today = new Date();
    
    
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
                    : (best.discountValue / variant.price) * 100;
                const currentValue = current.offerType === 'percentage'
                    ? current.discountValue
                    : (current.discountValue / variant.price) * 100;
                return currentValue > bestValue ? current : best;
            }, null);
        }
    }
    
    else if (globalOffers.length > 0) {
        bestOffer = globalOffers[0]; 
    }
    
    
    const updatedVariant = { ...variant };
    
    
    if (bestOffer) {
        const originalPrice = parseFloat(variant.price.toString());
        let discountAmount = 0;
        let finalPrice = originalPrice;
        
        if (bestOffer.offerType === 'percentage') {
            discountAmount = (originalPrice * bestOffer.discountValue) / 100;
            finalPrice = originalPrice - discountAmount;
        }
        else if (bestOffer.offerType === 'fixed') {
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
    } else {
        
        updatedVariant.originalPrice = parseFloat(variant.price.toString());
    }
    
    return updatedVariant;
};

export const singleProductFetch = async (productId) => {
    try {
        const today = new Date();
        
        const activeOffers = await Offer.find({
            status: 'active',
            startDate: { $lte: today },
            endDate: { $gte: today }
        }).lean();
        
        let product = await Product.aggregate([
            {$match: {productId: productId}},
            {
                $lookup: {
                    from: "categories",
                    localField: "categoryId",
                    foreignField: "_id",
                    as: "category"
                }
            },
            {$unwind: "$category"},
            {
                $lookup: {
                    from: "productvariants",
                    localField: "variantId",
                    foreignField: "_id",
                    as: "variants"
                }
            },
        ]);
        
        if (!product || product.length === 0) {
            return null;
        }
        
        product = product[0];
        
        if (Array.isArray(product.variants)) {
            product.variants = product.variants
                .filter(v => v.isActive === true)
                .map(v => ({
                    ...v,
                    price: v.price ? parseFloat(v.price.toString()) : 0
                }));
        }
        
        
        return applyBestOfferToProduct(product, activeOffers);
    } catch (error) {
        logger.error(`Error from singleProductFetch: ${error.message}`);
        throw error;
    }
};

export const productDetailsFilter = async () => {
    try {
        const today = new Date();
        
        const activeOffers = await Offer.find({
            status: 'active',
            startDate: { $lte: today },
            endDate: { $gte: today }
        }).lean();
        
        const products = await Product.aggregate([
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
            { $sort: { createdAt: -1 } },
            { $limit: 10 }
        ]);
        
        
        return products.map(item => applyBestOfferToProduct(item, activeOffers));
    } catch (error) {
        logger.error(`Error from productDetailsFilter: ${error.message}`);
        return [];
    }
};