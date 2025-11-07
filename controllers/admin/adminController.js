import { checkAdmin, validateAdminLogin } from "../../service/admin/adminService.js"

export const adminLoginGet = async (req, res) => {
    try {
        await checkAdmin()
        res.status(200).render("adminLogin", {error1: req.session.error1, error: req.session.error})

    } catch (error) {
        console.log(`Error from adminloginget : ${error}`)
        res.status(500).send("Internal Server Error")
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
            return res.status(404).redirect("/admin/adminLogin")
        }

        if(result.status === "Password Incorrect") {
            req.session.error = "Incorrect Password"
            return res.status(401).redirect("/admin/adminLogin")            
        }

        req.session.adminUsr = adminUsername
        return res.status(200).redirect("/admin/Dashboard")

    } catch (error) {
        console.error(`Error from adminLoginPost: ${error}`)
        res.status(500).redirect("/admin/adminLogin")
    }
}





