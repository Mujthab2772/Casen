// models/Offer.js
import { Schema, model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const offerSchema = new Schema(
  {
    offerId: {
      type: String,
      required: true,
      unique: true,
      default: () => uuidv4(), 
    },
    offerName: {
      type: String,
      required: [true, 'Offer name is required'],
      trim: true,
      minlength: [1, 'Offer name must be at least 1 character'],
      maxlength: [100, 'Offer name cannot exceed 100 characters'],
    },
    offerType: {
      type: String,
      required: [true, 'Offer type is required'],
      enum: {
        values: ['percentage', 'fixed'],
        message: 'Offer type must be "percentage" or "fixed"',
      },
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [0, 'Discount value cannot be negative'],
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    minPurchase: {
      type: Number,
      required: [true, 'Minimum purchase amount is required'],
      min: [0, 'Minimum purchase cannot be negative'],
      default: 0,
    },
    maxDiscountAmount: {
      type: Number,
      min: [0, 'Max discount amount cannot be negative'],
      default: null,
    },
    targeting: {
      categories: {
        type: [String],
        default: [],
        validate: {
          validator: function (arr) {
            return new Set(arr).size === arr.length;
          },
          message: 'Duplicate categories are not allowed',
        },
      },
      productIds: {
        type: [String],
        default: [],
        validate: {
          validator: function (arr) {
            return new Set(arr).size === arr.length;
          },
          message: 'Duplicate product IDs are not allowed',
        },
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, 
  }
);

offerSchema.pre('validate', function (next) {
  if (this.startDate && this.endDate && this.endDate <= this.startDate) {
    this.invalidate('endDate', 'End date must be after start date');
  }

  const hasCategories = this.targeting?.categories?.length > 0;
  const hasProductIds = this.targeting?.productIds?.length > 0;
  if (!hasCategories && !hasProductIds) {
    this.invalidate('targeting', 'Offer must apply to at least one category or product');
  }

  if (this.offerType === 'percentage' && this.discountValue > 100) {
    this.invalidate('discountValue', 'Percentage discount cannot exceed 100');
  }

  next();
});

offerSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
offerSchema.index({ 'targeting.categories': 1 });
offerSchema.index({ 'targeting.productIds': 1 });
offerSchema.index({ offerId: 1 }, { unique: true });

export default model('Offer', offerSchema);