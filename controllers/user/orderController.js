import { itemCancel, listOrder } from "../../service/user/orderService.js";

export const orderListing = async (req, res) => {
    try {
        const user = req.session.userDetail

        const result = await listOrder(user._id)

        return res.render('profileOrder', {user, orders: result})
    } catch (error) {
        console.log(`error form orderListing ${error}`);
        res.redirect('/profile')
    }
}

export const cancelItem = async (req, res) => {
  try {
    const user = req.session.userDetail;
    if (!user || !user._id) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const { orderId, itemIndex } = req.params;

    
    const index = parseInt(itemIndex, 10);
    if (isNaN(index)) {
      return res.status(400).json({ success: false, message: 'Invalid item index' });
    }

   
    const result = await itemCancel(
      { orderId, itemIndex: index }, 
      user._id
    );

    return res.json({ success: true });

  } catch (error) {
    console.log(`error from cancelItem ${error}`);
    
    return res.status(500).json({ success: false, message: 'Failed to cancel item' });
  }
};