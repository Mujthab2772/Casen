import { Product } from "../../models/productModel.js"

export const productDetails = async () => {
    try {
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
            { $sort: {createdAt: -1}}
        ]);
        
        return details
    } catch (error) {
        console.log(`error from landinpage Service product details ${error}`);
        throw error
    }
}