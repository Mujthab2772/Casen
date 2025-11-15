import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
    productId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "category",
        required: true
    },
    variantId: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProductVariant",
        required: true
    }],
    offerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Offer",
        default: null
    },
    productName: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
})


export const Product = mongoose.model("Product", productSchema)