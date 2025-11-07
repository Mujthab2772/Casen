import { checkAdmin, validateAdminLogin } from "../../service/admin/adminService.js"
import { STATUS_CODE } from "../../util/statusCodes.js"

export const adminLoginGet = async (req, res) => {
    try {
        await checkAdmin()
        res.status(STATUS_CODE.OK).render("adminLogin", {error1: req.session.error1, error: req.session.error})

    } catch (error) {
        console.log(`Error from adminloginget : ${error}`)
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).send("Internal Server Error")
    }
}

export const adminLoginPost = async (req, res) => {
    try {
        req.session.error = ""
        req.session.error1 = ""
        
        let {adminUsername, adminPassword} = req.body
        let result = await validateAdminLogin(adminUsername, adminPassword)

        if (result.status === "Not Found") {
            req.session.error1 = "User Not Found"
            return res.status(STATUS_CODE.NOT_FOUND).redirect("/admin/adminLogin")
        }

        if(result.status === "Password Incorrect") {
            req.session.error = "Incorrect Password"
            return res.status(STATUS_CODE.UNAUTHORIZED).redirect("/admin/adminLogin")            
        }

        req.session.adminUsr = adminUsername
        return res.status(STATUS_CODE.OK).redirect("/admin/Dashboard")

    } catch (error) {
        console.error(`Error from adminLoginPost: ${error}`)
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect("/admin/adminLogin")
    }
}





