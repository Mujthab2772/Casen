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
        let  userDetails = []
        let searchData = []
        let page = (req.session.page) || 1
        const limit = 5
        const skip = (page - 1) * limit
        let countCustomers = await userCollection.countDocuments({})

        if(!req.session.searchedUser) {
            userDetails = await userCollection.find({}, {_id: 1, userId: 1, firstName: 1, lastName: 1, email: 1, phoneNumber: 1, profilePic: 1, isActive: 1, createdAt: 1, updatedAt: 1}).sort({createdAt: -1}).skip(skip).limit(limit)
        }else {
            for (let key of req.session.searchedUser) {
                searchData = [...searchData, await userCollection.find({userId: key.userId}).sort({createdAt: -1}).skip(skip).limit(limit)]
            }
            userDetails = searchData.flat()
        }
        
        res.render("coustomersPage", {customers: userDetails, countCustomers: countCustomers, page: page, start: skip, end: Math.min(skip + limit, countCustomers)})
    } catch (error) {
        console.log(`error from customerGet: ${error}`)
    }
}

export const customerBlocking = async (req, res) => {
    try {
        let userDetail = await userCollection.findById({_id: req.params.Id})
        if(userDetail.isActive) {            
            await userCollection.updateOne({_id: req.params.Id}, {$set: {isActive: false}})
        }else {
            await userCollection.updateOne({_id: req.params.Id}, {$set: {isActive: true}})
        }
        
        res.redirect("/admin/customers")
    } catch (error) {
        console.log(`error from customerBlocking ${error}`)
    }
}

export const customerSearch = async (req, res) => {
    try {
        const {searchBar} = req.body
        let searchUsers = await userCollection.find({
            $or: [
                { firstName: { $regex: searchBar, $options: "i" } },
                { lastName: { $regex: searchBar, $options: "i" } },
                { email: { $regex: `${searchBar}.*@`, $options: "i" } },
                { phoneNumber: { $regex: searchBar, $options: "i" } }
            ]
        }).sort({createdAt: -1})

        req.session.searchedUser = searchUsers
        res.redirect("/admin/customers")
    } catch (error) {
        console.log(`error from customerSearch ${error}`)
    }
}

export const customerResetSearch = (req, res) => {
    try {
        req.session.searchedUser = null
        res.redirect("/admin/customers")
    } catch (error) {
        console.log(`error from customerResetSearch: ${error}`);        
    }
}

export const customerPagination = (req, res) => {
    try {
        req.session.page = parseInt(req.query.page)
        res.redirect("/admin/customers")
        
    } catch (error) {
        console.log(`error form customerPagination ${error}`);
        
    }
}