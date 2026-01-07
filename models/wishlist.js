import mongoose from "mongoose";

const wishlistSchema = new mongoose.Schema({
    wishlistId: {
        type: String,
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    variantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProductVariant',
        required: true
    }
},{
    timestamps: true
})

wishlistSchema.index({ userId: 1, productId: 1, variantId: 1 }, { unique: true });

const Wishlist = mongoose.model('Wishlist', wishlistSchema)

export default Wishlist