import { Transaction } from "../../models/transactionsModel.js"
import { Wallet } from "../../models/walletModel.js"

// Service
export const walletDetails = async(userId, page = 1, limit = 5) => {
    try {
        let wallet = await Wallet.findOne({userId});
        if(!wallet) {
            wallet = new Wallet({
                userId,
                'balance.amount': 0,
                'balance.currency': 'INR'
            });
            await wallet.save();
        }

        // Count total transactions for pagination metadata
        const totalTransactions = await Transaction.countDocuments({ wallet: wallet._id });
        
        // Get paginated transactions
        const transactions = await Transaction.find({ wallet: wallet._id })
            .sort({ createdAt: -1 }) // Most recent first
            .skip((page - 1) * limit)
            .limit(limit);
        
        const pagination = {
            total: totalTransactions,
            page: page,
            pages: Math.ceil(totalTransactions / limit),
            limit: limit
        };

        return { wallet, transaction: transactions, pagination };
    } catch (error) {
        console.log(`error from walletDetails ${error}`);
        throw error;
    }
}

export const walletAdd = async (userId, details) => {
    try {
        const {amount, description} = details
        const wallet = await Wallet.findOne({userId})

        if(!wallet){
            throw new Error('wallet not found')
        }

        const transaction = new Transaction({
            wallet: wallet._id,
            amount,
            currency: 'INR',
            type: 'topup',
            status: 'completed',
            description
        })
        wallet.balance.amount = Number(wallet.balance.amount) + amount
        
        await wallet.save()
        await transaction.save()

        return true
    } catch (error) {
        console.log(`error from walletAdd ${error}`);
        throw error
    }
}