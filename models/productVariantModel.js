import mongoose from "mongoose";

const productVariantSchema = new mongoose.Schema({
    variantId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    color: {
        type: String,
        required: true,
        trim: true
    },
    stock: {
        type: Number,
        required: true,
        min: 0
    },
    price: {
        type: mongoose.Schema.Types.Decimal128,
        required: true,
        min: 0,
        get: (v) => parseFloat(v.toString())
    },
    images: {
        type: [String],
        validate: [(val) => val.length <= 3, "Maximum 3 images allowed"]
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    toJSON: {getters: true}
})


export const ProductVariant = mongoose.model('ProductVariant', productVariantSchema)