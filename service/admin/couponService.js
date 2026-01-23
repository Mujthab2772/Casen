import couponModel from "../../models/couponModel.js";
import { v4 as uuidv4 } from "uuid";
import logger from '../../util/logger.js'; // ✅ Add logger import

export const fetchCouponsWithFilters = async ({
  page,
  limit,
  search,
  status,
  discountType
}) => {
  const skip = (page - 1) * limit;
  const now = new Date();
  const query = {};

  if (search) {
    const regex = new RegExp(search.trim(), 'i');
    query.$or = [
      { couponCode: regex },
      { discountType: regex }
    ];
  }

  if (status !== 'all') {
    if (status === 'active') {
      query.isActive = true;
      query.startDate = { $lte: now };
      query.endDate = { $gte: now };
    } else if (status === 'expired') {
      query.isActive = true;
      query.endDate = { $lt: now };
    } else if (status === 'scheduled') {
      query.isActive = true;
      query.startDate = { $gt: now };
    } else if (status === 'inactive') {
      query.isActive = false;
    }
  }

  if (discountType !== 'all') {
    query.discountType = discountType;
  }

  const coupons = await couponModel
    .find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalCoupons = await couponModel.countDocuments(query);
  const totalPages = Math.ceil(totalCoupons / limit);

  return { coupons, totalCoupons, totalPages };
};

export const couponAddNew = async (newCouponDetails) => {
  try {
    const {
      couponCode,
      discountType,
      discountAmount,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      perUserLimit
    } = newCouponDetails;

    const checkCoupon = await couponModel.findOne({couponCode: /couponCode/i})
    if(checkCoupon) {
      return 'Coupon already exits'
    }

    if(discountAmount > minAmount) return 'value must be less than Min purchase amount'

    const coupon = new couponModel({
      couponId: uuidv4(),
      couponCode,
      discountType,
      discountAmount,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      minAmount: minAmount || undefined,
      maxAmount: maxAmount || undefined,
      perUserLimit
    });

    await coupon.save();
    return 'successfully created'
  } catch (error) {
    logger.error(`Error from couponAddNew: ${error.message}`);
    throw error;
  }
};

export const activeEdit = async (couponCode) => {
  const coupon = await couponModel.findOne({ couponCode });
  if (!coupon) {
    throw new Error('Coupon not found');
  }
  coupon.isActive = !coupon.isActive;
  await coupon.save();
  return coupon;
};

export const couponUpdate = async (couponDetails) => {
  const {
    couponCode,
    discountType: newDiscountType,
    discountAmount,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    perUserLimit
  } = couponDetails;

  const existingCoupon = await couponModel.findOne({ couponCode });
  if (!existingCoupon) {
    throw new Error('Coupon not found');
  }

  if (newDiscountType !== existingCoupon.discountType) {
    throw new Error('Changing discount type after creation is not allowed');
  }

  const update = {
    discountAmount: parseFloat(discountAmount),
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    perUserLimit: parseInt(perUserLimit, 10)
  };

  if (minAmount != null && minAmount > 0) {
    update.minAmount = parseFloat(minAmount);
  }
  if (maxAmount != null && maxAmount > 0) {
    update.maxAmount = parseFloat(maxAmount);
  }

  const updated = await couponModel.findOneAndUpdate(
    { couponCode },
    update,
    { new: true, runValidators: true }
  );

  if (!updated) {
    throw new Error('Failed to update coupon');
  }

  return updated;
};