import userCollection from "../models/userModel.js";
import { STATUS_CODE } from "../util/statusCodes.js";


// Middleware: Redirect if already authenticated
export const preventAuthAccess = (req, res, next) => {
  if (req.session.isAuthenticated) {
    return res.redirect('/');
  }
  return next();
};


export const requireActiveUser = async (req, res, next) => {
  if(!req.session.isAuthenticated || !req.session.userEmail) {
    return next()
  }

  try {
    const user = await userCollection.findOne(
      {email: req.session.userEmail},
      {isActive: 1}
    )

    if(!user || !user.isActive) {
      req.session.destroy((err) => {
        if(err) console.log(`session destroy error ${err}`)
        res.clearCookie("connect.sid")
        return res.redirect('/')
      })
      return
    }

    next()
  } catch (error) {
    console.log(`error from requireActiveUser ${error}`);
    return res.status(STATUS_CODE.BAD_REQUEST).send("server error")
  }
}