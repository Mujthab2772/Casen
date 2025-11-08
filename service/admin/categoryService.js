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

export const categoryFetch = async (searchCategory) => {
    let fetchData
    if (!searchCategory) {
        fetchData = await categoryCollection.find({}).sort({createdAt: -1})
    } else {
        fetchData = await categoryCollection.find({categoryId: {$in: searchCategory}})
    }
    return fetchData
}

export const categorySearch = async (searchWord) => {
    let data = await categoryCollection.find({
        categoryName: { $regex: searchWord, $options: "i" }
    }, {_id: 0, categoryId: 1}).sort({createdAt: -1})

    data = data.map(item => item.categoryId)

    return data
}

export const toggleBlockAndUnblock = async (categoryid) => {
    try {
        let categoryDetail = await categoryCollection.findOne({categoryId: categoryid})

        if(!categoryDetail) throw new Error("User Not Found")

        if(categoryDetail.isVaild) {            
            await categoryCollection.updateOne({categoryId: categoryid}, {$set: {isVaild: false}})
        }else {
            await categoryCollection.updateOne({categoryId: categoryid}, {$set: {isVaild: true}})
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