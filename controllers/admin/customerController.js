import { customerDetails, toggleBlockAndUnblock } from "../../service/admin/customerService.js";
import { STATUS_CODE } from "../../util/statusCodes.js";
import logger from '../../util/logger.js'; // ✅ Adjust path as per your project structure

export const customers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const searchCustomer = req.query.searchCustomer || null;
    req.session.page = page;

    const { userDetails, countCustomers, skip, end } = await customerDetails(searchCustomer, page);

    return res.status(STATUS_CODE.OK).render("coustomersPage", {
      customers: userDetails,
      countCustomers,
      page,
      start: skip,
      end,
      searchCustomer
    });
  } catch (error) {
    logger.error(`Error in GET /admin/customers: ${error.message}`);
    return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).send("Internal Server Error");
  }
};

export const customerBlocking = async (req, res) => {
  try {
    const { Id: customerId } = req.params;
    await toggleBlockAndUnblock(customerId);
    logger.info(`Customer ${customerId} block/unblock status toggled`);
    return res.status(STATUS_CODE.OK).redirect(`/admin/customers?page=${req.session.page}`);
  } catch (error) {
    logger.error(`Error toggling block status for customer ${req.params.Id}: ${error.message}`);
    return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).send("Internal Server Error");
  }
};