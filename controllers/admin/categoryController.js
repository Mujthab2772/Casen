import { categoryAddToDb, categoryFetch, editCategoryPatchService, editingCategory, toggleBlockAndUnblock } from "../../service/admin/categoryService.js";
import { STATUS_CODE } from "../../util/statusCodes.js";
import { uploadToCloudinary } from "../../util/cloudinaryUpload.js";
import logger from '../../util/logger.js'; // ✅ Adjust path as per your project structure

export const category = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const searchCategory = req.query.searchCategory || null;
    req.session.categoryPage = page;

    const { categories, countCategory, categorySkip, end } = await categoryFetch(searchCategory, page);
    return res.status(STATUS_CODE.OK).render("CategoryManagementPage", {
      categories,
      page,
      countCategory,
      categorySkip,
      end,
      searchCategory,
    });
  } catch (error) {
    logger.error(`Error in GET /admin/category: ${error.message}`);
    return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/admin/category');
  }
};

export const addCategory = (req, res) => {
  try {
    return res.status(STATUS_CODE.OK).render("addCategory", { error: req.session.categoryerr });
  } catch (error) {
    logger.error(`Error in GET /admin/addcategory: ${error.message}`);
    return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/admin/addcategory');
  }
};

export const addCategoryUpdate = async (req, res) => {
  try {
    const { categoryName, description } = req.body;
    req.session.categoryerr = null;

    if (!categoryName?.trim()) {
      logger.warn('Category name is empty in POST /admin/addcategory');
      return res.status(STATUS_CODE.BAD_REQUEST).redirect("/admin/addcategory");
    }

    let fileUrl = null;
    if (req.file) {
      fileUrl = await uploadToCloudinary(req.file.path, "category-image");
    }

    let category;
    if (categoryName.trim() && description?.trim()) {
      category = await categoryAddToDb(categoryName, description, fileUrl);
    } else {
      // If description is missing, you may still want to handle it explicitly
      logger.warn(`Incomplete category data submitted: name="${categoryName}", description="${description}"`);
    }

    if (category?.status === "category already exists") {
      req.session.categoryerr = "category already exists";
      logger.warn(`Category creation failed: "${categoryName}" already exists`);
      return res.status(STATUS_CODE.CONFLICT).redirect("/admin/addcategory?success=false");
    }

    logger.info(`New category created: "${categoryName}"`);
    return res.status(STATUS_CODE.OK).redirect("/admin/category?success=true");

  } catch (error) {
    logger.error(`Error in POST /admin/addcategory: ${error.message}`);
    return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect("/admin/addcategory?success=false");
  }
};

export const validCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    await toggleBlockAndUnblock(categoryId);
    logger.info(`Category ${categoryId} toggled block/unblock status`);
    return res.status(STATUS_CODE.OK).redirect(`/admin/category?page=${req.session.categoryPage}`);
  } catch (error) {
    logger.error(`Error toggling block status for category ${req.params.categoryId}: ${error.message}`);
    return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/admin/category');
  }
};

export const editCategory = async (req, res) => {
  try {
    const { id: categorieDetailId } = req.params;
    const category = await editingCategory(categorieDetailId);

    req.session.editCategoryDetail = category;
    return res.status(STATUS_CODE.OK).render('editCategory', {
      error: req.session.err,
      categoryDetail: category,
    });
  } catch (error) {
    logger.error(`Error loading edit page for category ${req.params.id}: ${error.message}`);
    return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/admin/category');
  }
};

export const editCategoryUpdate = async (req, res) => {
  try {
    const { categoryName, description } = req.body;
    const { categoryid: categoryId } = req.params;
    req.session.err = null;

    if (!categoryName?.trim()) {
      req.session.err = "Cannot Be Empty The Category Name";
      logger.warn('Edit category failed: category name is empty');
      return res.status(STATUS_CODE.BAD_REQUEST).redirect("/admin/editCategory");
    }

    let fileUrl;
    if (req.file) {
      fileUrl = await uploadToCloudinary(req.file.path, "category-image");
    } else {
      fileUrl = req.session.editCategoryDetail?.image;
    }

    if (categoryName.trim() && description?.trim()) {
      await editCategoryPatchService(categoryName, description, fileUrl, categoryId);
      logger.info(`Category ${categoryId} updated successfully`);
    } else {
      logger.warn(`Partial update attempted for category ${categoryId}: missing fields`);
    }

    return res.status(STATUS_CODE.OK).redirect('/admin/category');

  } catch (error) {
    logger.error(`Error updating category ${req.params.categoryid}: ${error.message}`);
    return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/admin/editCategory');
  }
};