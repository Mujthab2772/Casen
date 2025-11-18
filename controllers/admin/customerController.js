import { customerDetails, toggleBlockAndUnblock } from "../../service/admin/customerService.js"
import { STATUS_CODE } from "../../util/statusCodes.js"


export const customers = async (req, res) => {
    try {
        let page = parseInt(req.query.page) || 1
        let searchCustomer = req.query.searchCustomer || null
        req.session.page = page
        
        const { userDetails, countCustomers, skip, end } = await customerDetails(searchCustomer, page)
        
        res.status(STATUS_CODE.OK).render("coustomersPage", {customers: userDetails, countCustomers: countCustomers, page: page, start: skip, end, searchCustomer})
    } catch (error) {
        console.error(`Error from customersGet: ${error}`)
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).send("Internal Server Error")
    }
}

export const customerBlocking = async (req, res) => {
    try {
        await toggleBlockAndUnblock(req.params.Id)
        res.status(STATUS_CODE.OK).redirect(`/admin/customers?page=${req.session.page}`)
    } catch (error) {
        console.error(`Error from customerBlocking: ${error}`)
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).send("Internal Server Error")
    }
}



