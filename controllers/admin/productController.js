import { addProductService, categoryDetails, editProductDetails, fetchProducts } from "../../service/admin/productService.js";

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

export const addProductsPost = async (req, res) => {
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
        const result = await editProductDetails(req.query.productid)
        const categoryResult = await categoryDetails()
        // console.log(result.categoryId)
        res.render('editProduct', {product: {variantId: result[0].variantId, categoryId: result[0].categoryId}, categories: categoryResult.options})
    } catch (error) {
        
    }
}