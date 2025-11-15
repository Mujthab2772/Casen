import categoryCollection from "../../models/categoryModel.js";
import { Product } from "../../models/productModel.js";
import { ProductVariant } from "../../models/productVariantModel.js";
import { uploadToCloudinary } from "../../util/cloudinaryUpload.js";
import { v4 as uuidv4 } from "uuid";

export const categoryDetails = async () => {
    try {
        const options = await categoryCollection.find({isValid: true})

        if(!options) {
            return {status: "No Category Available"}
        }

        return {options}
    } catch (error) {
        console.log(`error from categoryDetails ${error}`);
        throw error
    }
}


export const addProductService = async (req) => {
    try {
        const { productname, productdescription, categoryId} = req.body
        const files = req.files

        const variantImages = {};
        files.forEach((file) => {
            const match = file.fieldname.match(/variantImages_(\d+)(\[\])?/);
            if(match) {
                const index = match[1]
                if(!variantImages[index]) variantImages[index] = []
                variantImages[index].push(file.path)
            }
        });

        // Extract variant fields (can be arrays or single values)
        const variantColors = Array.isArray(req.body.variantcolor)
            ? req.body.variantcolor
            : [req.body.variantcolor];

        const variantPrices = Array.isArray(req.body.variantprice)
            ? req.body.variantprice
            : [req.body.variantprice];

        const variantStocks = Array.isArray(req.body.variantstock)
            ? req.body.variantstock
            : [req.body.variantstock];

        const createdVariants = []
        for (let i = 0; i < variantColors.length; i++) {
            const color = variantColors[i]
            const price = variantPrices[i]
            const stock = variantStocks[i]
            const images = variantImages[i] || []

            const uploadedImageUrls = []
            for(const localPath of images) {
                const uploaded = await uploadToCloudinary(localPath, "products_variants")
                if(uploaded) uploadedImageUrls.push(uploaded)
            }

            const variant = await ProductVariant({
                variantId: uuidv4(),
                color,
                stock,
                price,
                images: uploadedImageUrls
            })

            const savedVariant = await variant.save()
            createdVariants.push(savedVariant)
        }

        const variantIds = createdVariants.map((v) => v._id)

        const product = new Product({
            productId: uuidv4(),
            categoryId,
            variantId: variantIds,
            productName: productname,
            description: productdescription,
            isActive: true
        })

        const savedProduct = await product.save()

        return {
            message: "Product and variants saved successfully",
            product: savedProduct,
            variants: createdVariants
        }
    } catch (error) {
        console.log(`error from addproductservice ${error}`);
        throw error
    }
}


export const fetchProducts = async () => {
    try {
        const products = await Product.find({}).populate({
            path: "categoryId",
            model: "category",
            select: "categoryId categoryName description image"
        }).populate({
            path: "variantId",
            model: "ProductVariant",
            select: "variantId color stock price images"
        }).exec()

        if(!products){
            return null
        }

        const result = products.map(p => p.toObject({ getters: true }));

        return result
    } catch (error) {
        console.log(`error from fetchproducts ${error}`);
        throw error
    }
}


export const editProductDetails = async (productid) => {
    try {
        const products = await Product.find({productId: productid}).populate('categoryId').populate('variantId')
        return products
    } catch (error) {
        
    }
}