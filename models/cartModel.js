import mongoose from "mongoose";

const cartProductSchema = new mongoose.Schema({
  cartProductId: {
    type: String,
    required: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },
  variantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductVariant',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  }
}, { _id: false });

const cartSchema = new mongoose.Schema({
  cartId: {
    type: String,
    required: true,
    unique: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user', 
    required: true,
  },
  products: [cartProductSchema],
}, {
  timestamps: true, 
});

const Cart = mongoose.model('Cart', cartSchema);

export default Cart