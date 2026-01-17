import couponModel from "../../models/couponModel.js";
import { activeEdit, couponAddNew, couponUpdate, fetchCouponsWithFilters } from "../../service/admin/couponService.js";
import { STATUS_CODE } from "../../util/statusCodes.js";


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

    res.render('couponManagement', {
      coupons,
      currentPage: parseInt(page),
      totalPages,
      totalCoupons,
      search,
      status,
      discountType
    });
  } catch (error) {
    console.error(`Error in couponFetch: ${error}`);
    res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).send('Server error');
  }
};

export const newCoupon = async (req, res) => {
    try {
        res.render('newCoupon')
    } catch (error) {
        console.log(`errir from newCoupon ${error}`);
    }
}

export const addNewCoupon = async (req, res) => {
  try {
    const coupon = await couponAddNew(req.body);
    return res.status(STATUS_CODE.CREATED).json({
      success: true,
      message: 'Coupon created successfully'
    });
  } catch (error) {
    console.error('Error in addNewCoupon:', error);
    if (error.code === 11000) {
      return res.status(STATUS_CODE.CONFLICT).json({ success: false, message: 'Coupon code already exists' });
    }
    return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failed to create coupon' });
  }
};

export const editActive = async (req, res) => {
  try {
    const couponCode = req.params.couponCode;
    const updatedCoupon = await activeEdit(couponCode);
    res.status(STATUS_CODE.OK).json({ success: true, isActive: updatedCoupon.isActive });
  } catch (error) {
    console.log(`Error in editActive: ${error}`);
    res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failed to toggle coupon status' });
  }
};

export const editCoupon = async (req, res) => {
    try {
        const {couponCode} = req.params
        const coupon = await couponModel.findOne({couponCode})
        return res.render('editCoupon', {coupon})
    } catch (error) {
        console.log(`error from editCoupon ${error}`);
        
    }
}

export const updateEditCoupon = async (req, res) => {
  try {
    const { couponCode } = req.params;
    const updatedCoupon = await couponUpdate({
      couponCode,
      ...req.body
    });

    return res.status(STATUS_CODE.OK).json({
      success: true,
      message: 'Coupon updated successfully'
    });
  } catch (error) {
    console.error(`Error in updateEditCoupon: ${error.message}`);
    return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || 'Failed to update coupon'
    });
  }
};