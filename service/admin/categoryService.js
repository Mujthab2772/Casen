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