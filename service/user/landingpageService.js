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
            { $match: { "variants.isActive": true } }
        ]);
        
        return details
    } catch (error) {

    }
}