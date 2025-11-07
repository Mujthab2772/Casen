import { categoryAddToDb } from "../../service/admin/categoryService.js";
import { STATUS_CODE } from "../../util/statusCodes.js";
import { uploadToCloudinary } from "../../util/cloudinaryUpload.js";

export const categoryGet = (req, res) => {
    try {
        res.render("CategoryManagementPage")
    } catch (error) {
        log(`Error from categoryGet: ${error}`);
    }
}

export const addCategory = (req, res) => {
    try {
        res.render("addCategory", {error: req.session.categoryerr})
    } catch (error) {
        console.log(`Error from addCategory: ${error}`);
        
    }
}

export const addCategoryPost = async (req, res) => {
    try {
        const { categoryName, description } = req.body
        req.session.categoryerr = null
        if(categoryName.trim() === "") return res.status(STATUS_CODE.BAD_REQUEST).redirect("/admin/addcategoryPage")

        let fileUrl = null
        if(req.file) {
            fileUrl = await uploadToCloudinary(req.file.path, "category-image")
        }

        let category
        if (categoryName.trim() !== "" && description.trim() !== "") {
            category = await categoryAddToDb(categoryName, description, fileUrl)
        }

        if(category.status === "category already exists") {
            req.session.categoryerr = "category already exists"
            return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect("/admin/addcategoryPage?success=false")
        }

        
        return res.status(STATUS_CODE.OK).redirect("/admin/category?success=true")

    } catch (error) {
        console.log(`Error from addCategoryPost ${error}`);
        return res.status(STATUS_CODE.BAD_REQUEST).redirect("/admin/addcategoryPage?success=false")        
    }
}