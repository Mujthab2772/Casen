import admincollection from "../models/adminModel.js"
import userCollection from "../models/userModel.js"
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

export const customersGet = async (req, res) => {
    try {
        let userDetails = await userCollection.find({}, {userId: 1, firstName: 1, lastName: 1, email: 1, phoneNumber: 1, profilePic: 1, isActive: 1, createdAt: 1, updatedAt: 1})
        res.render("coustomersPage", {customers: userDetails})
    } catch (error) {
        console.log(`error from customerGet: ${error}`)
    }
}

export const customerBlocking = async (req, res) => {
    try {
        let userDetail = await userCollection.findById({_id: req.params.customerId})
        if(userDetail.isActive) {            
            await userCollection.updateOne({_id: req.params.customerId}, {$set: {isActive: false}})
        }else {
            await userCollection.updateOne({_id: req.params.customerId}, {$set: {isActive: true}})
        }
        
        res.redirect("/admin/customers")
    } catch (error) {
        console.log(`error from customerBlocking ${error}`)
    }
}