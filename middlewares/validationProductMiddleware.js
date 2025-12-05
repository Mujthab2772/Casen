import categoryCollection from "../models/categoryModel.js";
import { STATUS_CODE } from "../util/statusCodes.js";

// Helper: check if string is a valid positive number
const isValidPositiveNumber = (val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
};

// Helper: check if string is a valid non-negative integer
const isValidNonNegativeInt = (val) => {
    const num = parseInt(val, 10);
    return !isNaN(num) && num >= 0 && String(num) === String(val);
};

export const validateAddProduct = async (req, res, next) => {
    const { productname, productdescription, categoryId } = req.body;

// === Product Name ===
if (!productname || productname.trim() === "") {
    req.session.productErr = "Product name cannot be empty.";
    return res.status(STATUS_CODE.BAD_REQUEST).redirect(`/admin/addProduct?productid=${req.query.productid}&success=false`);
}
const trimmedName = productname.trim();
if (trimmedName.length < 2 || trimmedName.length > 100) {
    req.session.productErr = "Product name must be 2–100 characters.";
    return res.status(STATUS_CODE.BAD_REQUEST).redirect(`/admin/addProduct?productid=${req.query.productid}&success=false`);
}

// 🔒 Letters only — no numbers or special chars (except space, -, ')
const nameRegex = /^[a-zA-Z0-9\s\-']+$/;
if (!nameRegex.test(trimmedName)) {
    req.session.productErr = "Product name can only contain letters, spaces, hyphens, and apostrophes.";
    return res.status(STATUS_CODE.BAD_REQUEST).redirect(`/admin/addProduct?productid=${req.query.productid}&success=false`);
}

    // Optional: allow alphanumerics + basic chars
    if (!/^[a-zA-Z0-9\s\-',.()]+$/.test(trimmedName)) {
        req.session.productErr = "Product name contains invalid characters.";
        return res.status(STATUS_CODE.BAD_REQUEST).redirect("/admin/addProduct?success=false");
    }

    // // === Description ===
    if (!productdescription || productdescription.trim() === "") {
        req.session.productErr = "Description cannot be empty.";
        return res.status(STATUS_CODE.BAD_REQUEST).redirect("/admin/addProduct?success=false");
    }
    if (productdescription.length > 50) {
        req.session.productErr = "Description must be less than 50 characters.";
        return res.status(STATUS_CODE.BAD_REQUEST).redirect("/admin/addProduct?success=false");
    }

    // === Category ===
    if (!categoryId) {
        req.session.productErr = "Please select a category.";
        return res.status(STATUS_CODE.BAD_REQUEST).redirect("/admin/addProduct?success=false");
    }

    const category = await categoryCollection.findOne({ _id: categoryId, isValid: true });
    if (!category) {
        req.session.productErr = "Selected category is invalid or inactive.";
        return res.status(STATUS_CODE.BAD_REQUEST).redirect("/admin/addProduct?success=false");
    }

    // === Variants ===
    const colors = Array.isArray(req.body.variantcolor) ? req.body.variantcolor : [req.body.variantcolor];
    const prices = Array.isArray(req.body.variantprice) ? req.body.variantprice : [req.body.variantprice];
    const stocks = Array.isArray(req.body.variantstock) ? req.body.variantstock : [req.body.variantstock];

    if (colors.length === 0 || (colors.length === 1 && !colors[0])) {
        req.session.productErr = "At least one variant is required.";
        return res.status(STATUS_CODE.BAD_REQUEST).redirect("/admin/addProduct?success=false");
    }

    for (let i = 0; i < colors.length; i++) {
        const color = (colors[i] || "").trim();
        const price = prices[i];
        const stock = stocks[i];

        // Skip if all fields are empty (but at least one variant must exist)
        if (!color && !price && !stock) continue;

        if (!color) {
            req.session.productErr = `Variant ${i + 1}: Color is required.`;
            return res.status(STATUS_CODE.BAD_REQUEST).redirect("/admin/addProduct?success=false");
        }
        if (color.length > 100) {
            req.session.productErr = `Variant ${i + 1}: Color must be under 100 characters.`;
            return res.status(STATUS_CODE.BAD_REQUEST).redirect("/admin/addProduct?success=false");
        }
        if (!price || !isValidPositiveNumber(price)) {
            req.session.productErr = `Variant ${i + 1}: Price must be a valid positive number.`;
            return res.status(STATUS_CODE.BAD_REQUEST).redirect("/admin/addProduct?success=false");
        }
        if (stock === undefined || stock === null || !isValidNonNegativeInt(stock)) {
            req.session.productErr = `Variant ${i + 1}: Stock must be a non-negative integer.`;
            return res.status(STATUS_CODE.BAD_REQUEST).redirect("/admin/addProduct?success=false");
        }
    }

    // Clear error if all valid
    req.session.productErr = null;
    next();
};

export const validateEditProduct = async (req, res, next) => {
    const { productname, productdescription, categoryId } = req.body;


    // Same validations as add, except we allow partial updates
    if (!productname || productname.trim() === "") {
        req.session.productErr = "Product name cannot be empty.";
        return res.status(STATUS_CODE.BAD_REQUEST).redirect(`/admin/editProduct?productid=${req.params.productid}&success=false`);
    }
    const trimmedName = productname.trim();
    if (trimmedName.length < 2 || trimmedName.length > 100) {
        req.session.productErr = "Product name must be 2–100 characters.";
        return res.status(STATUS_CODE.BAD_REQUEST).redirect(`/admin/editProduct?productid=${req.params.productid}&success=false`);
    }

    if (!/^[a-zA-Z0-9\s\-',.()]+$/.test(trimmedName)) {
        req.session.productErr = "Product name contains invalid characters.";
        return res.status(STATUS_CODE.BAD_REQUEST).redirect(`/admin/editProduct?productid=${req.params.productid}&success=false`);
    }

    if (!productdescription || productdescription.trim() === "") {
        req.session.productErr = "Description cannot be empty.";
        return res.status(STATUS_CODE.BAD_REQUEST).redirect(`/admin/editProduct?productid=${req.params.productid}&success=false`);
    }
    if (productdescription.length > 50) {
        req.session.productErr = "Description must not exceed 50 characters.";
        return res.status(STATUS_CODE.BAD_REQUEST).redirect(`/admin/editProduct?productid=${req.params.productid}&success=false`);
    }

    if (!categoryId) {
        req.session.productErr = "Please select a category.";
        return res.status(STATUS_CODE.BAD_REQUEST).redirect(`/admin/editProduct?productid=${req.params.productid}&success=false`);
    }

    const category = await categoryCollection.findOne({ _id: categoryId, isValid: true });
    if (!category) {
        req.session.productErr = "Selected category is invalid or inactive.";
        return res.status(STATUS_CODE.BAD_REQUEST).redirect(`/admin/editProduct?productid=${req.params.productid}&success=false`);
    }

    // === Variants ===
    const colors = Array.isArray(req.body.variantcolor) ? req.body.variantcolor : [req.body.variantcolor];
    const prices = Array.isArray(req.body.variantprice) ? req.body.variantprice : [req.body.variantprice];
    const stocks = Array.isArray(req.body.variantstock) ? req.body.variantstock : [req.body.variantstock];

    let hasAtLeastOneValidVariant = false;

    for (let i = 0; i < colors.length; i++) {
        const color = (colors[i] || "").trim();
        const price = prices[i];
        const stock = stocks[i];

        // Skip completely empty rows
        if (!color && !price && !stock) continue;

        hasAtLeastOneValidVariant = true;

        if (!color) {
            req.session.productErr = `Variant ${i + 1}: Color is required.`;
            return res.status(STATUS_CODE.BAD_REQUEST).redirect(`/admin/editProduct?productid=${req.params.productid}&success=false`);
        }
        if (color.length > 100) {
            req.session.productErr = `Variant ${i + 1}: Color must be under 100 characters.`;
            return res.status(STATUS_CODE.BAD_REQUEST).redirect(`/admin/editProduct?productid=${req.params.productid}&success=false`);
        }
        if (!price || !isValidPositiveNumber(price)) {
            req.session.productErr = `Variant ${i + 1}: Price must be a valid positive number.`;
            return res.status(STATUS_CODE.BAD_REQUEST).redirect(`/admin/editProduct?productid=${req.params.productid}&success=false`);
        }
        if (stock === undefined || stock === null || !isValidNonNegativeInt(stock)) {
            req.session.productErr = `Variant ${i + 1}: Stock must be a non-negative integer.`;
            return res.status(STATUS_CODE.BAD_REQUEST).redirect(`/admin/editProduct?productid=${req.params.productid}&success=false`);
        }
    }

    if (!hasAtLeastOneValidVariant) {
        req.session.productErr = "At least one valid variant is required.";
        return res.status(STATUS_CODE.BAD_REQUEST).redirect(`/admin/editProduct?productid=${req.params.productid}&success=false`);
    }

    req.session.productErr = null;
    next();
};