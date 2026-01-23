import categoryModel from "../models/categoryModel.js";


export const validateCategoryName = async (categoryName, description, currentCategoryId = null) => {
    try {
        if(!categoryName || categoryName.trim() === '') {
            return "Category name cannot be empty."
        }

        const trimmed = categoryName.trim()

        if(trimmed.length < 2 || trimmed.length > 20) {
            return "Category name must be between 2 and 20 characters."
        }

        const nameRegex = /^[a-zA-Z\s\-']+$/
        if(!nameRegex.test(trimmed)) {
            return "Category name only contain letters, space, hypens, and apostrophes."
        }

        const existing = await categoryModel.findOne({
            categoryName: {$regex: `^${trimmed}$`, $options: 'i'}
        })

        if(existing) {
            if(currentCategoryId && existing.categoryId === currentCategoryId) {
                return null
            }
            return "A category with this name already exists"
        }

        // ===== Validate Description =====
        if (!description || description.trim() === "") {
            return "Description cannot be empty.";
        }

        const trimmedDesc = description.trim();
        if (trimmedDesc.length > 50) {
            return "Description must be less than 50 characters.";
        }

        return null
    } catch (error) {
        console.log(`error from validateCategoryName`);
        throw error
    }
}