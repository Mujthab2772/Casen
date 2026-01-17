import { categoryAddToDb, categoryFetch, editCategoryPatchService, editingCategory, toggleBlockAndUnblock } from "../../service/admin/categoryService.js";
import { STATUS_CODE } from "../../util/statusCodes.js";
import { uploadToCloudinary } from "../../util/cloudinaryUpload.js";

export const category = async (req, res) => {
    try {
        let page = parseInt(req.query.page) || 1
        let searchCategory = req.query.searchCategory || null
        req.session.categoryPage = page
        
        let {categories, countCategory, categorySkip, end} = await categoryFetch(searchCategory, page)
        return res.status(STATUS_CODE.OK).render("CategoryManagementPage", {categories, page, countCategory, categorySkip, end, searchCategory})
    } catch (error) {
        console.log(`Error from categoryGet: ${error}`);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/admin/category')
    }
}

export const addCategory = (req, res) => {
    try {
        return res.status(STATUS_CODE.OK).render("addCategory", {error: req.session.categoryerr})
    } catch (error) {
        console.log(`Error from addCategory: ${error}`);      
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/admin/addcategory')  
    }
}

export const addCategoryUpdate = async (req, res) => {
    try {
        const { categoryName, description } = req.body
        req.session.categoryerr = null
        if(categoryName.trim() === "") return res.status(STATUS_CODE.BAD_REQUEST).redirect("/admin/addcategory")

        let fileUrl = null
        if(req.file) {
            fileUrl = await uploadToCloudinary(req.file.path, "category-image")
        }

        let category = {}
        if (categoryName.trim() !== "" && description.trim() !== "") {
            category = await categoryAddToDb(categoryName, description, fileUrl)
        }

        if(category.status === "category already exists") {
            req.session.categoryerr = "category already exists"
            return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect("/admin/addcategory?success=false")
        }
        
        return res.status(STATUS_CODE.OK).redirect("/admin/category?success=true")

    } catch (error) {
        console.log(`Error from addCategoryPost ${error}`);
        return res.status(STATUS_CODE.BAD_REQUEST).redirect("/admin/addcategory?success=false")        
    }
}



export const validCategory = async (req, res) => {
    try {
        const categoryid = req.params.categoryId
        await toggleBlockAndUnblock(categoryid)
        return res.status(STATUS_CODE.OK).redirect(`/admin/category?page=${req.session.categoryPage}`)
    } catch (error) {
        console.log(`Error from validCategory ${error}`);        
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/admin/category')
    }
}


export const editCategory = async (req, res) => {
    try {
        const categorieDetailId = req.params.id
        let category = await editingCategory(categorieDetailId)

        req.session.editCategoryDetail = category
        return res.status(STATUS_CODE.OK).render('editCategory', {error: req.session.err, categoryDetail: category})
    } catch (error) {
        console.log(`error from editcategory ${error}`);        
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/admin/editCategory')
    }    
}

export const editCategoryUpdate = async (req, res) => {
    try {
        const { categoryName, description } = req.body
        const categoryId = req.params.categoryid
        req.session.err = null

        if(categoryName.trim() === "") {
            req.session.err = "Cannot Be Empty The Category Name"
            return res.status(STATUS_CODE.BAD_REQUEST).redirect("/admin/editCategory")
        }

        let fileUrl = null
        if(req.file) {
            fileUrl = await uploadToCloudinary(req.file.path, "category-image")
        }else {
            fileUrl = req.session.editCategoryDetail.image
        }        

        let category
        
        if (categoryName.trim() !== "" && description.trim() !== "") {
            category = await editCategoryPatchService(categoryName, description, fileUrl, categoryId)
        }        

        res.status(STATUS_CODE.OK).redirect('/admin/category')

    } catch (error) {
        console.log(`error from editCategoryPatch ${error}`);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/admin/editCategory')        
    }
}

