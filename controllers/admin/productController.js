import { addProductService, categoryDetails, editProductDetails, fetchProducts, toggleStatusProduct, updateProductService } from "../../service/admin/productService.js";
import { STATUS_CODE } from "../../util/statusCodes.js";

export const productsPage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1
        const searchProduct = req.query.searchProduct || null
        req.session.productPage = page

        const products = await fetchProducts(searchProduct, page)

        res.render('productPage', {products: products.result, page, countProduct: products.countProduct, productSkip: products.productSkip, end: products.end, searchProduct})
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

        res.render('productAddPage', {categories: result.options, error: req.session.productErr})
    } catch (error) {
        console.log(`error from addProductPage`);
        res.redirect('/admin/products')
    }
}

export const addProducts = async (req, res) => {
  try {
    const result = await addProductService(req)
    res.redirect("/admin/products?success=true");
  } catch (error) {
    console.error(`error from addProductsPost ${error}`);
    res.redirect("/admin/addProduct");
  }
};


export const editProduct = async (req, res) => {
  try {
    const productid = req.query.productid;
    const data = await editProductDetails(productid);
    const categories = await categoryDetails();

    if (!data || data.length === 0) {
      return res.redirect('/admin/products');
    }

    let product = data[0];

    // 🔧 Convert Decimal128 prices to strings for safe JSON
    if (Array.isArray(product.variantId)) {
      product.variantId = product.variantId.map(v => ({
        ...v,
        price: v.price && typeof v.price === 'object' && v.price.$numberDecimal
          ? v.price.$numberDecimal
          : String(v.price || '0'),
        stock: v.stock != null ? String(v.stock) : '0'
      }));
    }

    // ✅ ONLY pass product.data — clean and consistent
    res.status(STATUS_CODE.OK).render('editProduct', {
      product: { data: product }, // ← only this
      categories: categories.options || [],
      error: req.session.productErr
    });
  } catch (error) {
    console.error(`editProduct error:`, error);
    res.redirect('/admin/products');
  }
};

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

export const productStatus = async (req, res) => {
  try {
    const { productId, variantId } = req.query;

    await toggleStatusProduct(productId, variantId);

    // If it's an AJAX request (like from fetch), send JSON
    if (req.headers.accept?.includes('application/json')) {
      return res.json({ success: true });
    }

    // Otherwise, redirect (for non-AJAX fallback)
    res.redirect(`/admin/products?page=${req.session.productPage || 1}`);
  } catch (error) {
    console.error(`Error in productStatus: ${error}`);
    
    if (req.headers.accept?.includes('application/json')) {
      return res.status(500).json({ success: false, error: 'Update failed' });
    }
    
    res.redirect('/admin/products?error=1');
  }
};