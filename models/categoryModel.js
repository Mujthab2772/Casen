import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
    categoryId: {
        type: String,
        required: true,
        unique: true
    },
    offerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "offer",
        default: null
    },
    categoryName: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: "",
        trim: true
    },
    image: {
        type: String,
        default: ""
    },
    isVaild: {
        type: Boolean,
        default: true
    }

}, {
    timestamps: true
})

let categoryModel = mongoose.model("category", categorySchema)

export default categoryModel