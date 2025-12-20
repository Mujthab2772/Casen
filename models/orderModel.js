import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  _id: false,
  orderItemId: { type: String, required: true },
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  variantId: { type: String },
  variantColor: { type: String },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 }, 
  images: {
    type: [String],
    validate: [(val) => val.length <= 3, "Maximum 3 images allowed"]
  },
  orderStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'],
    default: 'pending'
  }
}, {
  timestamps: true
});

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  address: {
    _id: false,
    fullName: { type: String, required: true, trim: true },
    streetAddress: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    secondNumber: { type: String },
    email: { type: String },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true }
  },
  items: [orderItemSchema],
  subTotal: { type: Number, required: true, min: 0 },
  discountAmount: { type: Number, required: true, min: 0, default: 0 },
  taxAmount: { type: Number, required: true, min: 0, default: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  orderStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'requestingReturn', 'cancelled', 'returned'],
    default: 'pending'
  },
  returnReason: { type: String, default: null },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentId: { type: String },
  returnRequestedAt: { type: Date },
  returnApprovedAt: { type: Date },
  appliedCoupon: {
    couponId: { type: String },      
    couponCode: { type: String },   
    discountAmount: { type: Number }
  }
}, {
  timestamps: true
});

const orderModal = mongoose.model('order', orderSchema)

export default orderModal
