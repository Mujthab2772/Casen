import addressCollection from "../../models/addressModel.js";
import Cart from "../../models/cartModel.js";
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

export const tempOrder = async (userid, datas) => {
    try {
        const userId = new mongoose.Types.ObjectId(userid);
        const address = await addressCollection.find(
            {userId, addressId: datas.shippingAddressId},
            {_id: 0, fullName: 1, streetAddress: 1, phoneNumber: 1, city: 1, state: 1, postalCode: 1, country: 1}
        )

        const items = await Cart.aggregate([
            {$match: {userId}},
            {$unwind: '$products'},
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
                        { "products.variant.isActive": { $ne: false } },  // variant not blocked
                        { "products.variant.stock": { $gt: 0 } }

                    ]
                }
            },

            {$project: {
                _id: 0,
                'products.productId': 1,
                'products.variantId': 1,
                'products.quantity': 1,
                'products.variant': 1,
                'products.product': 1
            }}
        ])
        let productList = []

        for (let key of items) {
            productList.push(
                {
                orderItemId: uuidv4(),
                productId : key.products.product.productId,
                productName : key.products.product.productName,
                variantId : key.products.variant.variantId,
                variantColor : key.products.variant.color,
                quantity : key.products.quantity,
                price : key.products.variant.price,
                images : key.products.variant.images}                
            )
        }

        const addressDetails = {
            fullName: address[0].fullName,
            streetAddress: address[0].streetAddress,
            phoneNumber: address[0].phoneNumber,
            secondNumber: datas.contact.phone,
            email: datas.contact.email,
            city: address[0].city,
            state: address[0].state,
            postalCode: address[0].postalCode,
            country: address[0].country
        }

        return {productList, addressDetails}
    } catch (error) {
        console.log(`error from tempOrder ${error}`);
        throw error
    }
}