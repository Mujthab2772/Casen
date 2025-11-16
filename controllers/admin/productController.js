import { addProductService, categoryDetails, editProductDetails, fetchProducts, updateProductService } from "../../service/admin/productService.js";
import { STATUS_CODE } from "../../util/statusCodes.js";

export const productsPage = async (req, res) => {
    try {
        const products = await fetchProducts()
        res.render('productPage', {products})
    } catch (error) {
        console.log(`error from productsPage ${error}`);
        res.redirect('/admin/products')
    }
}

export const addProductPage = async (req, res) => {
    try {
        const result = await categoryDetails()

        if(result.status === "No Category Available") {
            return res.redirect('/admin/addProducts')
        }

        res.render('productAddPage', {categories: result.options})
    } catch (error) {
        console.log(`error from addProductPage`);
        res.redirect('/admin/products')
    }
}

export const addProducts = async (req, res) => {
  try {
    const result = await addProductService(req)
    res.redirect("/admin/products");
  } catch (error) {
    console.error(`error from addProductsPost ${error}`);
    res.redirect("/admin/addProduct");
  }
};


export const editProduct = async (req, res) => {
    try {
        const productid = req.query.productid
        const data = await editProductDetails(productid)
        const categories = await categoryDetails()
        
        res.status(STATUS_CODE.OK).render('editProduct', {product: {data: data[0],variantId: data[0].variantId, categoryId: data[0].categoryId}, categories: categories.options || []})
    } catch (error) {
        console.log(`error from editProduct ${error}`);
        res.redirect('/admin/products')
    }
}

export const updateProduct = async (req, res) => {
    try {
        const productId = req.params.productid

        const result = await updateProductService(req, productId)

        res.status(STATUS_CODE.OK).redirect('/admin/products')
    } catch (error) {
        console.log(`error from updateProduct ${error}`);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/admin/editProduct')
    }
}