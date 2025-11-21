import { Product } from "../../models/productModel.js"
import userCollection from "../../models/userModel.js";

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

export const userDetail = async (useremail) => {
    try {
        const user = await userCollection.findOne({email: useremail}, {
            _id: 1,
            userId: 1,
            firstName: 1,
            lastName: 1,
            email: 1,
            phoneNumber: 1,
            profilePic: 1,
            isActive: 1,
            createdAt: 1,
            updatedAt: 1
        })
        
        if(!user) {
            return {status: "user is not found"}
        }

        return user
    } catch (error) {
        console.log(`error fromuserDetail ${error}`);
        throw error
    }
}