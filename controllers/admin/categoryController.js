import { categoryAddToDb, categoryFetch, categorySearch, editCategoryPatchService, editingCategory, toggleBlockAndUnblock } from "../../service/admin/categoryService.js";
import { STATUS_CODE } from "../../util/statusCodes.js";
import { uploadToCloudinary } from "../../util/cloudinaryUpload.js";

export const categoryGet = async (req, res) => {
    try {
        let page = (req.session.categoryPage) || 1
        let {categories, countCategory, categorySkip, end} = await categoryFetch(req.session.categorieSearched, page)
        return res.status(STATUS_CODE.OK).render("CategoryManagementPage", {categories, page, countCategory, categorySkip, end})
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
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/admin/addcategoryPage')  
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

export const searchCategory = async (req, res) => {
    try {
        const { searchCategory } = req.body
        req.session.categorieSearched = null
        if (searchCategory.trim() !== "") {
            let searched = await categorySearch(searchCategory)
            req.session.categorieSearched = searched
        }
        return res.status(STATUS_CODE.OK).redirect('/admin/category')
    } catch (error) {
        console.log(`error from searchCategory ${error}`);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/admin/category')
    }
}

export const validCategory = async (req, res) => {
    try {
        const categoryid = req.params.categoryId
        await toggleBlockAndUnblock(categoryid)
        return res.status(STATUS_CODE.OK).redirect("/admin/category")
    } catch (error) {
        console.log(`Error from validCategory ${error}`);        
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/admin/category')
    }
}

export const editCategoryGet = (req, res) => {
    try {        
        return res.status(STATUS_CODE.OK).render('editCategory', {error: req.session.err, categoryDetail: req.session.editCategoryDetail})
    } catch (error) {
        console.log(`error from editCategoryGet ${error}`);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/admin/editcategory')
    }
}

export const editCategory = async (req, res) => {
    try {
        const categorieDetailId = req.params.id
        let category = await editingCategory(categorieDetailId)
        
        req.session.editCategoryDetail = category
        return res.status(STATUS_CODE.OK).redirect('/admin/editCategory')
    } catch (error) {
        console.log(`error from editcategory ${error}`);        
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/admin/editCategory')
    }    
}

export const editCategoryPatch = async (req, res) => {
    try {
        const { categoryName, description } = req.body
        const categoryId = req.params.id
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

export const categoryPagination = (req, res) => {
    try {
        req.session.categoryPage = parseInt(req.query.categoryPage)
        return res.status(STATUS_CODE.OK).redirect('/admin/category')
    } catch (error) {
        console.log(`error from categoryPagination ${error}`);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).send("internal server error")
    }
}