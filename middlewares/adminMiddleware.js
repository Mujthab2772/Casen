import { STATUS_CODE } from "../util/statusCodes.js";
import { validateCategoryName } from "../util/validationCategory.js";

export const adminCheck = async (req, res, next) => {
    try {
        if (req.session.adminUsr) {
            return next()
        }
        res.redirect('/admin/login')
    } catch (error) {
        console.log(`error from adminCheck ${error}`);
    }
}

export const adminCheckLogin = async (req, res, next) => {
    try {
        if(!req.session.adminUsr){
            return next()
        }
        res.redirect('/admin/products')
    } catch (error) {
        console.log(`error from adminchecklogin ${error}`);
    }
}

export const validateAddCategory = async (req, res, next) => {
    try {
        const { categoryName, description } = req.body
        const error = await validateCategoryName(categoryName, description)

        if(error) {
            req.session.categoryerr = error
            return res.status(STATUS_CODE.BAD_REQUEST).redirect('/admin/addcategory?success=false')
        }

        next()
    } catch (error) {
        console.log(`error validateAddCategory ${error}`);        
    }
}

export const validateEditCategory = async (req, res, next) => {
    try {
        const {categoryName, description} = req.body
        const categoryId = req.params.categoryid || null

        const error = await validateCategoryName(categoryName, description, categoryId)

        if(error) {
            req.session.err = error
            return res.status(STATUS_CODE.BAD_REQUEST).redirect(`/admin/editCategory/${categoryId}?success=false`)
        }

        next()
    } catch (error) {
        console.log(`error from validEditCategory ${error}`);        
    }
}