import mongoose from "mongoose";
import { v4 as uuidv4 } from 'uuid';

const transactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    default: () => uuidv4(), // Auto-generated UUIDv4
    unique: true,
    required: true
  },
  wallet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true
  },
  amount: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    validate: {
      validator: v => !isNaN(v),
      message: 'Invalid amount value'
    }
  },
  currency: {
    type: String,
    required: true,
    enum: ['INR', 'USD', 'EUR']
  },
  type: {
    type: String,
    enum: ['payment', 'refund', 'topup'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'reversed'],
    default: 'pending',
    required: true
  },
  description: {
    type: String,
    maxlength: 200,
    required: function() {
      return !['topup'].includes(this.type);
    }
  },
  reference: {
    orderId: String,
    paymentId: String,
  }
}, {
  timestamps: true,
});

// Virtual for API exposure (maps to UUID)
transactionSchema.virtual('id').get(function() {
  return this.transactionId;
});

// Indexes for performance
transactionSchema.index({ wallet: 1, createdAt: -1 }); // Fast wallet history
transactionSchema.index({ transactionId: 1 }, { unique: true });
transactionSchema.index({ 'reference.orderId': 1 });

export const Transaction = mongoose.model('Transaction', transactionSchema);