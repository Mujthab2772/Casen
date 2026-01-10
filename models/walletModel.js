import mongoose from "mongoose";
import { v4 as uuidv4 } from 'uuid';

const walletSchema = new mongoose.Schema({
  walletId: {
    type: String,
    default: () => uuidv4(),
    unique: true,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  balance: {
    amount: {
      type: mongoose.Schema.Types.Decimal128,
      default: new mongoose.Types.Decimal128("0.00"),
    },
    currency: {
      type: String,
      default: 'INR',
      enum: ['INR', 'USD', 'EUR'],
      required: true
    }
  }
}, {
  timestamps: true,
});

walletSchema.index({ userId: 1 }, { unique: true });
walletSchema.index({ walletId: 1 }, { unique: true });

export const Wallet = mongoose.model('Wallet', walletSchema);