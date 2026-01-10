import mongoose from "mongoose";
import { v4 as uuidv4 } from 'uuid';

const transactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    default: () => uuidv4(),
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
    required: true
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
    maxlength: 200
  },
  reference: {
    orderId: String
  }
}, {
  timestamps: true,
});

transactionSchema.index({ wallet: 1, createdAt: -1 });
transactionSchema.index({ transactionId: 1 }, { unique: true });
transactionSchema.index({ 'reference.orderId': 1 });

export const Transaction = mongoose.model('Transaction', transactionSchema);