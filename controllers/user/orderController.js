import { itemCancel, listOrder, orderCancelEntire, productReturn, returnItem } from "../../service/user/orderService.js";
import { STATUS_CODE } from "../../util/statusCodes.js";

export const orderListing = async (req, res) => {
  try {
    const user = req.session.userDetail;
    if (!user) return res.redirect('/login');
    
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const status = req.query.status || 'all';
    const search = (req.query.search || '').trim();

    const result = await listOrder(user._id, page, limit, status, search);
    
    return res.render('profileOrder', {
      user,
      orders: result.orders,
      pagination: result.pagination,
      currentStatus: status,
      currentSearch: search
    });
  } catch (error) {
    console.log(`error from orderListing ${error}`);
    res.redirect('/profile');
  }
};

export const cancelItem = async (req, res) => {
  try {
    const user = req.session.userDetail;
    if (!user || !user._id) {
      return res.status(STATUS_CODE.UNAUTHORIZED).json({ success: false, message: 'User not authenticated' });
    }

    const { orderId, itemIndex } = req.params;

    
    const index = parseInt(itemIndex, 10);
    if (isNaN(index)) {
      return res.status(STATUS_CODE.BAD_REQUEST).json({ success: false, message: 'Invalid item index' });
    }

   
    const result = await itemCancel(
      { orderId, itemIndex: index }, 
      user._id
    );

    return res.json({ success: true });

  } catch (error) {
    console.log(`error from cancelItem ${error}`);
    
    return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failed to cancel item' });
  }
};

export const cancelOrder = async (req, res) => {
  try {
    // console.log(req.params.orderId)

    const userId = req.session.userDetail._id
    const orderId = req.params.orderId

    const result = await orderCancelEntire(orderId, userId)

    res.json({ success: true, message: result.message });
  } catch (error) {
    console.log(`error from cancelOrder ${error}`);
    res.redirect('/profile/orders')
  }
}

export const returnProduct = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const userId = req.session.userDetail._id;

    if (!reason || reason.trim().length < 5) {
      return res.status(STATUS_CODE.BAD_REQUEST).json({
        success: false,
        message: 'Return reason is required and must be at least 5 characters.'
      });
    }

    await productReturn(orderId, userId, reason.trim());

    return res.json({ success: true, message: 'Return request submitted successfully.' });

  } catch (error) {
    console.log(`error from returnProduct ${error}`);
    
    return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to process return request. Please try again.'
    });
  }
};

export const itemReturn = async (req, res) => {
  try {
    const { reason } = req.body
    const { orderId, itemIndex } = req.params
    const userId = req.session.userDetail._id;

    if (!reason || reason.trim().length < 5) {
      return res.status(STATUS_CODE.BAD_REQUEST).json({
        success: false,
        message: 'Return reason is required and must be at least 5 characters.'
      });
    }

    await returnItem(orderId, userId, reason, itemIndex)

    return res.json({ success: true, message: 'Return request submitted successfully.'})
  } catch (error) {
    console.log(`error from itemReturn ${error}`);
    return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to process return request. Please try again'
    })
  }
}