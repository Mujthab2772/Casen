import { addWishlist, removeWishlist, wishlistItems } from "../../service/user/wishlistService.js";
import { STATUS_CODE } from "../../util/statusCodes.js";

export const wishlist = async (req, res) => {
  try {
    const user = req.session.userDetail;
    if (!user) return res.redirect('/profile');

    const page = parseInt(req.query.page) || 1;
    const limit = 6; 
    const skip = (page - 1) * limit;

    const { items, totalItems } = await wishlistItems(user._id, skip, limit);
    const totalPages = Math.ceil(totalItems / limit);

    return res.render('wishlist', {
      user,
      wishlistItems: items,
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    });
  } catch (error) {
    console.log(`Error from wishlist: ${error}`);
    return res.redirect('/profile');
  }
};

export const wishlistadd = async (req, res) => {
    try {
        const userId = req.session.userDetail?._id
        if (!userId) {
            return res.status(STATUS_CODE.UNAUTHORIZED).json({
                success: false,
                message: "Unauthorized"
            });
        }
        const result = await addWishlist(userId, req.body)

        return res.status(STATUS_CODE.OK).json({success: result})
    } catch (error) {
        console.log(`error from wishlistadd ${error}`);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Internal server error'
        })  
    }
}

export const wishlistRemove = async (req, res) => {
  try {
    console.log(req.query.itemId)
    const result = await removeWishlist(req.query.itemId)

    return res.status(STATUS_CODE.OK).json({message: result})
  } catch (error) {
    console.log(`error from wishlistRemove ${error}`);
    return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json()
  }
}