import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({
    couponId: {
        type: String,
        required: true,
        unique: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        default: null
    },
    couponCode: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    discountType: {
        type: String,
        enum: ['percentage', 'fixed'], 
        required: true 
    },
    discountAmount: {
        type: Number,
        min: 0,
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    minAmount: {
        type: Number,
        min: 0,
        default: 0
    },
    maxAmount: {
        type: Number,
        min: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    perUserLimit: {
        type: Number,
        min: 0,
        default: 1
    }
}, {
    timestamps: true
});


couponSchema.index({ couponCode: 1 }, {unique: true});

couponSchema.pre('save', function (next) {
    if (this.startDate && this.endDate && this.endDate < this.startDate) {
        const err = new Error('endDate must be greater than or equal to startDate');
        return next(err);
    }
    next();
});

export default mongoose.model('Coupon', couponSchema);