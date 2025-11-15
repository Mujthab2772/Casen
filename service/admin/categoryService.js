import categoryCollection from "../../models/categoryModel.js";
import { v4 as uuidv4 } from "uuid";

export const categoryAddToDb = async (categoryName, description, fileUrl) => {
    let existCategory = await categoryCollection.findOne({categoryName: categoryName})

    if(existCategory) return {status: "category already exists"}

    const categoryDatas = new categoryCollection({
        categoryId: uuidv4(),
        categoryName: categoryName,
        description: description,
        image: fileUrl,
        isValid: true
    })

    await categoryDatas.save()
    return {status: "Success", categoryDatas}
}

export const categoryFetch = async (search = null, page, limit = 5) => {
    const categorySkip = (page - 1) * limit
    
    let filter = {};

    if (search) {
        filter.categoryName = { $regex: search, $options: "i" }
    }

    const countCategory = await categoryCollection.countDocuments(filter)

    const categories = await categoryCollection.find(filter)
        .sort({ createdAt: -1 })
        .skip(categorySkip)
        .limit(limit)
    
    return {categories, countCategory, categorySkip, end: Math.min(categorySkip + limit, countCategory)}
}

export const toggleBlockAndUnblock = async (categoryid) => {
    try {
        let categoryDetail = await categoryCollection.findOne({categoryId: categoryid})

        if(!categoryDetail) throw new Error("User Not Found")

        if(categoryDetail.isValid) {            
            await categoryCollection.updateOne({categoryId: categoryid}, {$set: {isValid: false}})
        }else {
            await categoryCollection.updateOne({categoryId: categoryid}, {$set: {isValid: true}})
        }
    } catch (error) {
        console.log(`Error from toggleBlockAndUnblock ${error}`);
        throw error
    }
}

export const editingCategory = async (categorieId) => {
    try {
        let category = await categoryCollection.findById({_id: categorieId})
        return category
    } catch (error) {
        console.log(`error from editingCategory ${error}`);        
    }
}

export const editCategoryPatchService = async (categoryName, description, fileUrl, category) => {
    try {
        let updateCategory = await categoryCollection.updateOne({_id: category}, {$set: {categoryName: categoryName, description: description, image: fileUrl}})
        return updateCategory
    } catch (error) {
        console.log(`error from editCategoryPatchService ${error}`);        
    }
}