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
        message: 'Offer type must be one of: percentage, fixed, buyonegetone, free_shipping',
      },
    },
    discountValue: {
      type: Number,
      validate: {
        validator: function (value) {
          if (['free_shipping', 'buyonegetone'].includes(this.offerType)) {
            return true;
          }
          return value != null && value > 0;
        },
        message: 'Discount value is required for this offer type',
      },
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
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    targetingType: {
      type: String,
      enum: ['all', 'products', 'categories'],
      default: 'all',
    },
    targeting: {
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
      categoryIds: {
        type: [String],
        default: [],
        validate: {
          validator: function (arr) {
            return new Set(arr).size === arr.length;
          },
          message: 'Duplicate category IDs are not allowed',
        },
      },
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
  if (this.targetingType === 'products' && (!this.targeting.productIds || this.targeting.productIds.length === 0)) {
    this.invalidate('targeting', 'At least one product must be selected');
  }
  if (this.targetingType === 'categories' && (!this.targeting.categoryIds || this.targeting.categoryIds.length === 0)) {
    this.invalidate('targeting', 'At least one category must be selected');
  }
  if (this.offerType === 'percentage' && this.discountValue > 100) {
    this.invalidate('discountValue', 'Percentage discount cannot exceed 100');
  }
  if (this.targetingType === 'all') {
    this.targeting.productIds = [];
    this.targeting.categoryIds = [];
  }
  next();
});

offerSchema.index({ status: 1, startDate: 1, endDate: 1 });
offerSchema.index({ 'targeting.categoryIds': 1 });
offerSchema.index({ 'targeting.productIds': 1 });
offerSchema.index({ offerId: 1 }, { unique: true });

export default model('Offer', offerSchema);