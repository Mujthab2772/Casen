import categoryModel from "../../models/categoryModel.js";
import { Product } from "../../models/productModel.js";
import Offer from "../../models/offerModel.js";
import logger from '../../util/logger.js';

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
        
        // Process search parameter
        let searchString = '';
        if (typeof search === 'string') {
            searchString = search.trim();
        } else if (Array.isArray(search)) {
            searchString = search[0] ? search[0].trim() : '';
        }
        
        // Initial match stage
        const matchStage = { isActive: true };
        if (searchString) {
            matchStage.productName = { $regex: searchString, $options: 'i' };
        }
        pipeline.push({ $match: matchStage });
        
        // Category lookup and filtering
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
        
        // Variant lookup and processing
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
        
        // Category filter
        if (category) {
            const cats = (typeof category === 'string' ? category.split(',') : [])
                .map(c => c.trim())
                .filter(c => c);
            if (cats.length > 0) {
                pipeline.push({ $match: { "category.categoryName": { $in: cats } } });
            }
        }
        
        // Product filter
        if (product) {
            const prods = (typeof product === 'string' ? product.split(',') : [])
                .map(p => p.trim())
                .filter(p => p);
            if (prods.length > 0) {
                pipeline.push({ $match: { productName: { $in: prods } } });
            }
        }
        
        // Color filter
        if (color) {
            const colorRegex = new RegExp(color.trim(), 'i');
            pipeline.push({ $match: { "variants.color": colorRegex } });
        }

        // Determine if we need special handling for price operations
        const requiresPriceProcessing = 
            (minPrice !== undefined || maxPrice !== undefined) || 
            ['priceLowToHigh', 'priceHighToLow'].includes(sort);

        let data, total;

        if (requiresPriceProcessing) {
            // Remove pagination/sort stages for price processing
            const pricePipeline = pipeline.filter(stage => 
                !stage.$skip && 
                !stage.$limit && 
                !(stage.$sort && ['priceLowToHigh', 'priceHighToLow'].includes(sort))
            );

            // Fetch all matching documents
            let allData = await Product.aggregate(pricePipeline);
            
            // Apply offers first
            allData = allData.map(item => applyBestOfferToProduct(item, activeOffers));
            
            // Apply price filter on discounted prices
            if (minPrice !== undefined || maxPrice !== undefined) {
                const min = minPrice ? parseFloat(minPrice) : -Infinity;
                const max = maxPrice ? parseFloat(maxPrice) : Infinity;
                
                allData = allData.filter(item => {
                    const finalPrice = item.variants?.offerInfo?.finalPrice ?? item.variants?.price;
                    return finalPrice >= min && finalPrice <= max;
                });
            }
            
            // Apply price-based sorting
            if (['priceLowToHigh', 'priceHighToLow'].includes(sort)) {
                const sortOrder = sort === 'priceLowToHigh' ? 1 : -1;
                allData.sort((a, b) => {
                    const priceA = a.variants?.offerInfo?.finalPrice ?? a.variants?.price;
                    const priceB = b.variants?.offerInfo?.finalPrice ?? b.variants?.price;
                    return (priceA - priceB) * sortOrder;
                });
            }
            
            // Manual pagination
            total = allData.length;
            const skip = (page - 1) * limit;
            data = allData.slice(skip, skip + limit);
        } else {
            // Standard processing for non-price operations
            const sortMap = {
                'aA-zZ': { productName: 1 },
                'zZ-aA': { productName: -1 },
                newest: { createdAt: -1 },
                bestselling: { salesCount: -1 } // Add actual field for bestselling
            };
            
            const sortStage = sortMap[sort] || { createdAt: -1 };
            pipeline.push({ $sort: sortStage });
            
            // Pagination stages
            const skip = (page - 1) * limit;
            pipeline.push({ $skip: skip }, { $limit: limit });
            
            // Execute aggregation
            data = await Product.aggregate(pipeline);
            data = data.map(item => applyBestOfferToProduct(item, activeOffers));
            
            // Count pipeline for pagination
            const countPipeline = pipeline
                .filter(s => !s.$skip && !s.$limit && !s.$sort)
                .concat({ $count: "total" });
            const countRes = await Product.aggregate(countPipeline);
            total = countRes.length ? countRes[0].total : 0;
        }

        // Fetch category and product lists
        const [allCategories, allproducts] = await Promise.all([
            categoryModel.find({ isValid: true }, { categoryName: 1 }).lean(),
            Product.distinct('productName', { isActive: true })
        ]);

        return {
            data,
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

// Unified offer application logic
const applyBestOfferToProduct = (product, activeOffers) => {
    if (!product || !product.variants) {
        return product;
    }

    const productIdStr = product._id.toString();
    const categoryIdStr = product.category?._id?.toString() || '';

    // Handle array of variants
    if (Array.isArray(product.variants)) {
        return {
            ...product,
            variants: product.variants.map(variant => 
                applyOfferToVariant(variant, productIdStr, categoryIdStr, activeOffers)
            )
        };
    } 
    // Handle single variant object
    else {
        const updatedVariant = applyOfferToVariant(
            product.variants, 
            productIdStr, 
            categoryIdStr, 
            activeOffers
        );
        
        return {
            ...product,
            variants: updatedVariant,
            offerInfo: updatedVariant.offerInfo
        };
    }
};

const applyOfferToVariant = (variant, productIdStr, categoryIdStr, activeOffers) => {
    if (!variant || !variant.price || variant.price <= 0) {
        return variant;
    }

    const originalPrice = parseFloat(variant.price.toString());
    
    // Filter relevant offers
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
    
    // Prioritize specific offers (product/category) over global
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
    // Fallback to best global offer
    else if (globalOffers.length > 0) {
        bestOffer = globalOffers.reduce((best, current) => {
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
    
    // Create updated variant with offer info
    const updatedVariant = { 
        ...variant, 
        originalPrice: originalPrice,
        hasOffer: false,
        offerInfo: null
    };
    
    // Apply best offer if found
    if (bestOffer) {
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
            originalPrice,
            discountAmount,
            finalPrice
        };
        
        updatedVariant.originalPrice = originalPrice;
        updatedVariant.price = finalPrice;
        updatedVariant.hasOffer = true;
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