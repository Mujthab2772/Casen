import { addressAdd, addressDelete, addressDetails, editAddressDetails, editAddressDetailsUpdate } from "../../service/user/addressService.js";
import { STATUS_CODE } from "../../util/statusCodes.js";

export const address = async (req, res) => {
  try {
    const user = req.session.userDetail;
    if (!user || !user._id) {
      return res.redirect('/login'); // or appropriate fallback
    }
    const userAddresses = await addressDetails(user._id);
    res.render('address', { user, addresses: userAddresses }); // pass addresses to template
  } catch (error) {
    console.log(`error from address ${error}`);
    res.redirect('/profile');
  }
};

export const addressFetch = (req, res) => {
    try {
        const user = req.session.userDetail        
        res.render('addressAdd', {user})
    } catch (error) {
        console.log(`error from addressNew ${error}`);
        res.redirect('/profile/address')
    }
}

export const addressNew = async (req, res) => {
  try {
    const address = await addressAdd(req.body, req.query.userId);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error saving address:', error);
    return res.status(500).json({ ok: false, msg: 'An unexpected error occurred.' });
  }
};

export const addressEdit = async (req, res) => {
    try {
        const user = req.session.userDetail
        const result = await editAddressDetails(req.query.addressId)

        return res.render('addressEdit', {user, address: result})
    } catch (error) {
        console.log(`error from addressEdit ${error}`);
        res.redirect('/profile/address')        
    }
}

export const addressEditUpdate = async (req, res) => {
    try {
        const user = req.session.userDetail
        const result = await editAddressDetailsUpdate(req.body, req.query.addressId, user._id)

        if(result === 'Address Not found') return res.status(STATUS_CODE.BAD_REQUEST).json({success: false})

        return res.status(STATUS_CODE.OK).json({success: true}) 
    } catch (error) {
        console.log(`error from addressEditUpdate ${error}`);
        res.redirect('/profile/address')
    }
}

export const deleteAddress = async (req, res) => {
  try {
    const result = await addressDelete(req.query.addressId);

    if (result === 'success') {
      // If using fetch (AJAX), send JSON
      if (req.xhr || req.headers.accept?.includes('json')) {
        return res.status(200).json({ success: true });
      }
      // Fallback for non-JS users (unlikely in this case)
      return res.redirect('/profile/address');
    } else {
      throw new Error('Address not found');
    }
  } catch (error) {
    console.log(`error from deleteAddress ${error}`);
    if (req.xhr || req.headers.accept?.includes('json')) {
      return res.status(500).json({ success: false, error: 'Deletion failed' });
    }
    return res.redirect('/profile/address');
  }
};