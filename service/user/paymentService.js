import orderCollection from "../../models/orderModel.js";
import { v4 as uuidv4 } from "uuid";
import { ProductVariant } from "../../models/productVariantModel.js";

export const orderCalculation = async (recalculated, req) => {
    try {
        // If cart is now empty or invalid, redirect back to cart
        if (!recalculated?.productList?.length) {
            req.session.checkout = null; // Clear stale data
            return null
        }

        // ✅ Build a fresh, accurate order summary
        const validItems = recalculated.productList;
        const subtotal = validItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const discount = validItems.length > 0 ? 40 : 0; // Your discount logic
        const tax = 0; // Or calculate if needed
        const total = Math.max(0, subtotal - discount + tax);

        // 🔒 Store only the validated product list and address, NOT the summary
        req.session.items = validItems;
        req.session.address = recalculated.addressDetails;

        // ✅ Pass the freshly calculated summary to the view
        const checkoutDetail = {
            contact: req.session.checkout?.contact,
            shippingAddressId: req.session.checkout?.shippingAddressId,
            orderSummary: {
                subtotal: subtotal.toFixed(2),
                discount: discount.toFixed(2),
                tax: tax.toFixed(2),
                total: total.toFixed(2)
            }
        };


        return checkoutDetail
    } catch (error) {
        console.log(`errro from orderCalculaion ${error}`);
        throw error
    }
}

export const cashOnDelivery = async (req) => {
    try {
        // console.log(req.session)
        // console.log(req.body);
        const userId = req.session.userDetail?._id

        for (let item of req.session.items) {
            const variant = await ProductVariant.findOne(
                { variantId: item.variantId },
                { stock: 1, isActive: 1 }
            );

            if (!variant || !variant.isActive || variant.stock < item.quantity) {
                throw new Error(`Item ${item.productName} is out of stock or unavailable.`);
            }

            // Only then reduce stock
            await ProductVariant.findOneAndUpdate(
                { variantId: item.variantId },
                { $inc: { stock: -item.quantity } },
                { new: true }
            );
        }

        const orderDetail = new orderCollection({
            orderId: uuidv4(),
            userId: userId,
            address: req.session.address,
            items: req.session.items,
            subTotal: req.session.checkout?.orderSummary?.subtotal,
            discountAmount: req.session.checkout?.orderSummary?.discount,
            taxAmount: req.session.checkout?.orderSummary?.tax,
            totalAmount: req.session.checkout?.orderSummary?.total,
            paymentId: uuidv4()
        })

        await orderDetail.save()

        return orderDetail
    } catch (error) {
        console.log(`error from cashOnDelivery ${error}`);
        throw error
    }
}

export const orderDetails = async (userId, orderId) => {
    try {
        let result = null
        if (orderId) {
            result = await orderCollection.find({ userId, orderId })
        }

        return result
    } catch (error) {
        console.log(`error from orderDetails ${error}`);
        throw error
    }
}