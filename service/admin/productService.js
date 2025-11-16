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
        const data = await Product.find({productId: productid})
        .populate('categoryId')
        .populate('variantId')
        
        if(!data) {
            return {status: "Not Found"}
        }
        
        return data
    } catch (error) {
        console.log(`error from editProductDetails ${error}`);
        throw error
    }
}

export const updateProductService = async (req, productId) => {
    try {
        const { productname, productdescription, categoryId } = req.body

        const product = await Product.findOne({productId}).populate('variantId')
        
        if(!product) throw new Error("Product not found")

        // Parse uploaded files with correct regex pattern
        const variantImages = {}
        if (req.files && req.files.length > 0) {
            req.files.forEach((file) => {
                const match = file.fieldname.match(/variantImages_(\d+)_(\d+)/)
                
                if(match) {
                    const variantIndex = parseInt(match[1]) // Convert to number
                    const imageIndex = parseInt(match[2])   // Convert to number
                    
                    if(!variantImages[variantIndex]) {
                        variantImages[variantIndex] = {}
                    }
                    variantImages[variantIndex][imageIndex] = file.path
                }
            })
        }

        // Parse existing images from request body
        let existingImages = {} // Changed from const to let
        if (req.body.existingImages) {
            try {
                existingImages = JSON.parse(req.body.existingImages)
            } catch (e) {
                console.log('Failed to parse existingImages:', e)
            }
        }

        const variantColors = Array.isArray(req.body.variantcolor)
            ? req.body.variantcolor
            : [req.body.variantcolor]

        const variantPrices = Array.isArray(req.body.variantprice)
            ? req.body.variantprice
            : [req.body.variantprice]

        const variantStocks = Array.isArray(req.body.variantstock)
            ? req.body.variantstock
            : [req.body.variantstock]

        // ======= FIX: Collect properly ordered variant IDs =======
        const variantIdsFromBody = {};

        Object.keys(req.body)
        .filter(k => k.startsWith("variantId_"))
        .forEach(k => {
            const index = Number(k.split("_")[1]);
            variantIdsFromBody[index] = req.body[k];
        });


        const updateVariantIds = []

        // Process each variant
        for (let i = 0; i < variantColors.length; i++) {
    const color = variantColors[i]
    const price = variantPrices[i]
    const stock = variantStocks[i]
    const variantIdFromBody = variantIdsFromBody[i] || null

    // ====== FIX: Skip completely empty variant rows ======
    if (
        (!color || color.trim() === "") &&
        (!price || price.trim() === "") &&
        (!stock || stock.trim() === "")
    ) {
        continue; 
    }

    let variant;

    if (variantIdFromBody) {
        // Update existing variant
        variant = await ProductVariant.findById(variantIdFromBody)
        if (!variant) continue

        variant.color = color
        variant.price = price
        variant.stock = stock

        const finalImages = []
        const existingVariantImages = existingImages[i] || []

        for (let imgIdx = 0; imgIdx < 3; imgIdx++) {
            if (variantImages[i] && variantImages[i][imgIdx]) {
                const uploaded = await uploadToCloudinary(
                    variantImages[i][imgIdx],
                    "product_variants"
                )
                if (uploaded) finalImages.push(uploaded)
            } else if (existingVariantImages[imgIdx]) {
                finalImages.push(existingVariantImages[imgIdx])
            }
        }

        variant.images = finalImages
        await variant.save()
        updateVariantIds.push(variant._id)

    } else {
        // Create new variant
        const newVariant = new ProductVariant({
            variantId: uuidv4(),
            color,
            price,
            stock,
            images: []
        })

        if (variantImages[i]) {
            for (let imgIdx = 0; imgIdx < 3; imgIdx++) {
                if (variantImages[i][imgIdx]) {
                    const uploaded = await uploadToCloudinary(
                        variantImages[i][imgIdx],
                        'product_variants'
                    )
                    if (uploaded) {
                        newVariant.images.push(uploaded)
                    }
                }
            }
        }

        const saved = await newVariant.save()
        updateVariantIds.push(saved._id)
    }
}


        // Delete removed variants
        const currentVariantIds = product.variantId.map((v) => v._id.toString())
        const updateVariantIdStrings = updateVariantIds.map(id => id.toString())
        const deleted = currentVariantIds.filter(
            (id) => !updateVariantIdStrings.includes(id)
        )

        await ProductVariant.deleteMany({ _id: { $in: deleted } })
        
        // Update product
        product.productName = productname || product.productName
        product.description = productdescription || product.description
        product.categoryId = categoryId || product.categoryId
        product.variantId = updateVariantIds

        const updatedProduct = await product.save()
        
        return {
            product: updatedProduct,
            variants: updateVariantIds
        }

    } catch (error) {
        console.log(`error from updateproductservice ${error}`)
        throw error
    }
}