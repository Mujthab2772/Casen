import { 
  addressAdd, 
  addressDelete, 
  addressDetails, 
  editAddressDetails, 
  editAddressDetailsUpdate 
} from "../../service/user/addressService.js";
import { STATUS_CODE } from "../../util/statusCodes.js";
import logger from '../../util/logger.js'; // ✅ Adjust path as per your project structure

export const address = async (req, res) => {
  try {
    const user = req.session.userDetail;
    if (!user || !user._id) {
      logger.warn('Unauthorized access to address page: no user session');
      return res.redirect('/login');
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 3;

    const result = await addressDetails(user._id, page, limit);

    return res.render('address', {
      user,
      addresses: result.addresses,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error(`Error loading user address page (user ID: ${req.session.userDetail?._id}): ${error.message}`);
    return res.redirect('/profile');
  }
};

export const addressFetch = (req, res) => {
  try {
    const user = req.session.userDetail;
    if (!user) {
      logger.warn('Access to add address without valid session');
      return res.redirect('/login');
    }
    return res.render('addressAdd', { user });
  } catch (error) {
    logger.error(`Error rendering address add form: ${error.message}`);
    return res.redirect('/profile/address');
  }
};

export const addressNew = async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      logger.warn('Address creation attempted without userId');
      return res.status(STATUS_CODE.BAD_REQUEST).json({ ok: false, msg: 'User ID missing' });
    }

    await addressAdd(req.body, userId);
    logger.info(`New address added for user: ${userId}`);
    return res.status(STATUS_CODE.OK).json({ ok: true });
  } catch (error) {
    logger.error(`Error saving address for user ${req.query.userId}: ${error.message}`);
    return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ ok: false, msg: 'An unexpected error occurred.' });
  }
};

export const addressEdit = async (req, res) => {
  try {
    const user = req.session.userDetail;
    if (!user) {
      logger.warn('Edit address requested without valid session');
      return res.redirect('/login');
    }

    const { addressId } = req.query;
    if (!addressId) {
      logger.warn('Edit address requested without addressId');
      return res.redirect('/profile/address');
    }

    const result = await editAddressDetails(addressId);
    if (!result) {
      logger.warn(`Address not found for edit (ID: ${addressId})`);
      return res.redirect('/profile/address');
    }

    return res.render('addressEdit', { user, address: result });
  } catch (error) {
    logger.error(`Error loading address edit page (address ID: ${req.query.addressId}): ${error.message}`);
    return res.redirect('/profile/address');
  }
};

export const addressEditUpdate = async (req, res) => {
  try {
    const user = req.session.userDetail;
    if (!user || !user._id) {
      logger.warn('Address update attempted without valid user session');
      return res.status(STATUS_CODE.UNAUTHORIZED).json({ success: false });
    }

    const { addressId } = req.query;
    if (!addressId) {
      logger.warn('Address update missing addressId');
      return res.status(STATUS_CODE.BAD_REQUEST).json({ success: false });
    }

    const result = await editAddressDetailsUpdate(req.body, addressId, user._id);

    if (result === 'Address Not found') {
      logger.warn(`Update failed: address not found (ID: ${addressId}, user: ${user._id})`);
      return res.status(STATUS_CODE.NOT_FOUND).json({ success: false });
    }

    logger.info(`Address ${addressId} updated successfully for user ${user._id}`);
    return res.status(STATUS_CODE.OK).json({ success: true });
  } catch (error) {
    logger.error(`Error updating address (ID: ${req.query.addressId}, user: ${req.session.userDetail?._id}): ${error.message}`);
    return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ success: false });
  }
};

export const deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.query;
    if (!addressId) {
      logger.warn('Delete address requested without addressId');
      return res.status(STATUS_CODE.BAD_REQUEST).json({ success: false });
    }

    const result = await addressDelete(addressId);

    if (result === 'success') {
      logger.info(`Address ${addressId} deleted successfully`);
      if (req.xhr || req.headers.accept?.includes('json')) {
        return res.status(STATUS_CODE.OK).json({ success: true });
      }
      return res.redirect('/profile/address');
    } else {
      logger.warn(`Delete failed: address not found (ID: ${addressId})`);
      throw new Error('Address not found');
    }
  } catch (error) {
    logger.error(`Error deleting address (ID: ${req.query.addressId}): ${error.message}`);
    if (req.xhr || req.headers.accept?.includes('json')) {
      return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ success: false, error: 'Deletion failed' });
    }
    return res.redirect('/profile/address');
  }
};