import couponModel from "../../models/couponModel.js";
import { activeEdit, couponAddNew, couponUpdate, fetchCouponsWithFilters } from "../../service/admin/couponService.js";
import { STATUS_CODE } from "../../util/statusCodes.js";
import logger from '../../util/logger.js'; // ✅ Adjust path if needed

export const couponFetch = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 5,
      search = '',
      status = 'all',
      discountType = 'all'
    } = req.query;

    const { coupons, totalCoupons, totalPages } = await fetchCouponsWithFilters({
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      status,
      discountType
    });

    return res.render('couponManagement', {
      coupons,
      currentPage: parseInt(page),
      totalPages,
      totalCoupons,
      search,
      status,
      discountType
    });
  } catch (error) {
    logger.error(`Error in GET /admin/coupons (couponFetch): ${error.message}`);
    return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).send('Server error');
  }
};

export const newCoupon = async (req, res) => {
  try {
    return res.render('newCoupon');
  } catch (error) {
    logger.error(`Error rendering new coupon form: ${error.message}`);
    return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).send('Failed to load coupon creation page');
  }
};

export const addNewCoupon = async (req, res) => {
  try {
    const coupon = await couponAddNew(req.body);
    logger.info(`New coupon created: ${req.body.couponCode}`);
    return res.status(STATUS_CODE.CREATED).json({
      success: true,
      message: 'Coupon created successfully'
    });
  } catch (error) {
    if (error.code === 11000) {
      logger.warn(`Coupon creation failed: duplicate code "${req.body.couponCode}"`);
      return res.status(STATUS_CODE.CONFLICT).json({ success: false, message: 'Coupon code already exists' });
    }
    logger.error(`Error creating coupon: ${error.message}`);
    return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failed to create coupon' });
  }
};

export const editActive = async (req, res) => {
  try {
    const { couponCode } = req.params;
    const updatedCoupon = await activeEdit(couponCode);
    logger.info(`Coupon ${couponCode} status toggled to ${updatedCoupon.isActive ? 'active' : 'inactive'}`);
    return res.status(STATUS_CODE.OK).json({ success: true, isActive: updatedCoupon.isActive });
  } catch (error) {
    logger.error(`Error toggling coupon status for ${req.params.couponCode}: ${error.message}`);
    return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failed to toggle coupon status' });
  }
};

export const editCoupon = async (req, res) => {
  try {
    const { couponCode } = req.params;
    const coupon = await couponModel.findOne({ couponCode });
    if (!coupon) {
      logger.warn(`Edit coupon page requested for non-existent coupon: ${couponCode}`);
      return res.status(STATUS_CODE.NOT_FOUND).send('Coupon not found');
    }
    return res.render('editCoupon', { coupon });
  } catch (error) {
    logger.error(`Error loading edit page for coupon ${req.params.couponCode}: ${error.message}`);
    return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).send('Failed to load coupon edit page');
  }
};

export const updateEditCoupon = async (req, res) => {
  try {
    const { couponCode } = req.params;
    const updatedCoupon = await couponUpdate({
      couponCode,
      ...req.body
    });
    logger.info(`Coupon ${couponCode} updated successfully`);
    return res.status(STATUS_CODE.OK).json({
      success: true,
      message: 'Coupon updated successfully'
    });
  } catch (error) {
    logger.error(`Error updating coupon ${req.params.couponCode}: ${error.message}`);
    return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || 'Failed to update coupon'
    });
  }
};