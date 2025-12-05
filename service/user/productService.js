import categoryModel from "../../models/categoryModel.js";
import { Product } from "../../models/productModel.js"

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

    // Normalize search
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

    // Lookups
    pipeline.push({ $lookup: { from: "categories", localField: "categoryId", foreignField: "_id", as: "category" } });
    pipeline.push({ $unwind: "$category" });
    pipeline.push({ $match: { "category.isValid": true } });

    pipeline.push({ $lookup: { from: "productvariants", localField: "variantId", foreignField: "_id", as: "variants" } });
    pipeline.push({ $unwind: "$variants" });
    pipeline.push({
  $addFields: {
    "variants.price": { $toDouble: "$variants.price" }
  }
})
    pipeline.push({ $match: { "variants.isActive": true } });

    // Category filter (exact match, multi-select)
    if (category) {
      const cats = (typeof category === 'string' ? category.split(',') : [])
        .map(c => c.trim())
        .filter(c => c);
      if (cats.length > 0) {
        pipeline.push({ $match: { "category.categoryName": { $in: cats } } });
      }
    }

    // Product filter (exact match, multi-select)
    if (product) {
      const prods = (typeof product === 'string' ? product.split(',') : [])
        .map(p => p.trim())
        .filter(p => p);
      if (prods.length > 0) {
        pipeline.push({ $match: { productName: { $in: prods } } });
      }
    }

    // Price range
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

    // Sorting
    const sortMap = {
      priceLowToHigh: { "variants.price": 1 },
      priceHighToLow: { "variants.price": -1 },
      'aA-zZ': { productName: 1 },
      'zZ-aA': { productName: -1 },
      newest: { createdAt: -1 }
    };
    const sortStage = sortMap[sort] || { createdAt: -1 };
    pipeline.push({ $sort: sortStage });

    // Pagination
    const skip = (page - 1) * limit;
    pipeline.push({ $skip: skip }, { $limit: limit });

    const data = await Product.aggregate(pipeline);

    // Count (for pagination)
    const countPipeline = pipeline
      .filter(s => !s.$skip && !s.$limit && !s.$sort)
      .concat({ $count: "total" });
    const countRes = await Product.aggregate(countPipeline);
    const total = countRes.length ? countRes[0].total : 0;

    const allCategories = await categoryModel.find({isValid: true}, {categoryName: 1}).lean()
    const allproducts = await Product.distinct('productName', {isActive: true})

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
    console.error(`[productDetails] Error:`, error);
    throw error;
  }
};


export const singleProductFetch = async (productId) => {
    try {
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
        ])

        if (!product) {
            return {status: "product not found"}
        }

        product = product[0]
        if (Array.isArray(product.variants)) {
            product.variants = product.variants
            .filter(v => v.isActive === true)
            .map(v => ({
                ...v,
                price: v.price ? parseFloat(v.price.toString()) : 0
            }));
        }


        return product
    } catch (error) {
        console.log(`error from singleProductFetch ${error}`);
        throw error
    }
}
