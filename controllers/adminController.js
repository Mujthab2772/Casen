import admincollection from "../models/adminModel.js"
import { v4 as uuidv4 } from "uuid"

export const adminLoginGet = async (req, res) => {
    try {
        let defaultAdmin = await admincollection.findOne({adminName: process.env.ADMIN_NAME})

        if(!defaultAdmin) {
            let adminData = {
                adminId: uuidv4(),
                adminName: process.env.ADMIN_NAME,
                adminPassword: process.env.ADMIN_PASSWORD
            }
            let newAdmin = new admincollection(adminData)
            await newAdmin.save()
        }

        res.render("adminLogin", {error1: req.session.error1, error: req.session.error})

    } catch (error) {
        console.log(`Error from adminloginget : ${error}`)
    }
}

export const adminLoginPost = async (req, res) => {
    try {
        req.session.error = ""
        req.session.error1 = ""
        let {adminUsername, adminPassword} = req.body
        let admin = await admincollection.findOne({adminName: adminUsername})
        req.session.adminUsr = adminUsername
        if(adminPassword === admin.adminPassword) {
            return res.redirect("/admin/Dashboard")
        }else{
            req.session.error = "Incorrect Password"
            return res.redirect("/admin/adminLogin")
        }
    } catch (error) {
        req.session.error1 = "User Not Found"
        console.log(`Error from adminloginpost : ${error}`)
        res.redirect("/admin/adminLogin")
    }
}