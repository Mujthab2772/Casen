import { customerDetails, searchForUser, toggleBlockAndUnblock } from "../../service/admin/customerService.js"
import { STATUS_CODE } from "../../util/statusCodes.js"


export const customersGet = async (req, res) => {
    try {
        let page = (req.session.page) || 1
        const { userDetails, countCustomers, skip, end } = await customerDetails(req.session.searchedUser, page)
        
        res.status(STATUS_CODE.OK).render("coustomersPage", {customers: userDetails, countCustomers: countCustomers, page: page, start: skip, end})
    } catch (error) {
        console.error(`Error from customersGet: ${error}`)
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).send("Internal Server Error")
    }
}

export const customerBlocking = async (req, res) => {
    try {
        await toggleBlockAndUnblock(req.params.Id)
        res.status(STATUS_CODE.OK).redirect("/admin/customers")
    } catch (error) {
        console.error(`Error from customerBlocking: ${error}`)
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).send("Internal Server Error")
    }
}

export const customerSearch = async (req, res) => {
    try {
        const { searchBar } = req.body
        if (searchBar.trim() !== "") {
            let searchedUser = await searchForUser(searchBar.trim())
            req.session.searchedUser = searchedUser
        }
         res.status(STATUS_CODE.OK).redirect("/admin/customers")
    } catch (error) {
        console.error(`Error from customerSearch: ${error}`)
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).send("Internal Server Error")
    }
}

export const customerResetSearch = (req, res) => {
    try {
        req.session.searchedUser = null
         res.status(STATUS_CODE.OK).redirect("/admin/customers")
    } catch (error) {
        console.error(`Error from customerResetSearch: ${error}`)
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).send("Internal Server Error")        
    }
}

export const customerPagination = (req, res) => {
    try {
        req.session.page = parseInt(req.query.page)
        res.status(STATUS_CODE.OK).redirect("/admin/customers")
        
    } catch (error) {
        console.error(`Error from customerPagination: ${error}`)
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).send("Internal Server Error")
        
    }
}