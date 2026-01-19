import { checkAdmin, validateAdminLogin } from "../../service/admin/adminService.js";
import { STATUS_CODE } from "../../util/statusCodes.js";
import logger from '../../util/logger.js'; // Adjust path as needed to your logger file

export const adminLogin = async (req, res) => {
  try {
    await checkAdmin();
    res.status(STATUS_CODE.OK).render("adminLogin", {
      error1: req.session.error1,
      error: req.session.error,
    });
  } catch (error) {
    logger.error(`Error from adminLogin GET: ${error.message}`);
    res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).send("Internal Server Error");
  }
};

export const adminLoginVerify = async (req, res) => {
  try {
    req.session.error = "";
    req.session.error1 = "";

    const { adminUsername, adminPassword } = req.body;
    const result = await validateAdminLogin(adminUsername, adminPassword);

    if (result.status === "Not Found") {
      req.session.error1 = "User Not Found";
      logger.warn(`Admin login attempt failed: User not found (${adminUsername})`);
      return res.status(STATUS_CODE.NOT_FOUND).redirect("/admin/login");
    }

    if (result.status === "Password Incorrect") {
      req.session.error = "Incorrect Password";
      logger.warn(`Admin login attempt failed: Incorrect password for ${adminUsername}`);
      return res.status(STATUS_CODE.UNAUTHORIZED).redirect("/admin/login");
    }

    req.session.adminUsr = adminUsername;
    logger.info(`Admin ${adminUsername} successfully logged in.`);
    return res.status(STATUS_CODE.OK).redirect("/admin/dashboard");
  } catch (error) {
    logger.error(`Error from adminLogin POST: ${error.message}`);
    res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect("/admin/login");
  }
};

export const logout = async (req, res) => {
  try {
    const adminUsr = req.session.adminUsr || 'Unknown';
    req.session.destroy((err) => {
      if (err) {
        logger.error(`Session destroy error during admin logout: ${err.message}`);
        return res.send("Error Logging out");
      }
      res.clearCookie("connect.sid");
      logger.info(`Admin ${adminUsr} successfully logged out.`);
      res.redirect('/admin');
    });
  } catch (error) {
    logger.error(`Unexpected error in admin logout: ${error.message}`);
    // Even in catch, we should respond
    res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).send("Logout failed");
  }
};