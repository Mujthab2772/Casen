import { 
  addProductService, 
  categoryDetails, 
  editProductDetails, 
  fetchProducts, 
  toggleStatusProduct, 
  updateProductService 
} from "../../service/admin/productService.js";
import { STATUS_CODE } from "../../util/statusCodes.js";
import logger from '../../util/logger.js'; // ✅ Adjust path as per your project structure

export const productsPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const searchProduct = req.query.searchProduct || null;
    req.session.productPage = page;

    const products = await fetchProducts(searchProduct, page);

    return res.render('productPage', {
      products: products.result,
      page,
      countProduct: products.countProduct,
      productSkip: products.productSkip,
      end: products.end,
      searchProduct
    });
  } catch (error) {
    logger.error(`Error loading products page: ${error.message}`);
    return res.redirect('/admin/products');
  }
};

export const addProductPage = async (req, res) => {
  try {
    const result = await categoryDetails();
    const error = req.session.productErr;
    req.session.productErr = null;

    if (result.status === "No Category Available") {
      logger.warn('Admin tried to add product but no categories exist');
      return res.redirect('/admin/addProducts');
    }

    return res.render('productAddPage', {
      categories: result.options,
      error
    });
  } catch (error) {
    logger.error(`Error loading add product page: ${error.message}`);
    return res.redirect('/admin/products');
  }
};

export const addProducts = async (req, res) => {
  try {
    await addProductService(req);
    logger.info(`New product created by admin`);
    return res.redirect("/admin/products?success=true");
  } catch (error) {
    logger.error(`Error creating product: ${error.message}`);
    return res.redirect("/admin/addProduct");
  }
};

export const editProduct = async (req, res) => {
  try {
    const { productid } = req.query;
    if (!productid) {
      logger.warn('Edit product requested without product ID');
      return res.redirect('/admin/products');
    }

    const data = await editProductDetails(productid);
    const categories = await categoryDetails();
    const error = req.session.productErr;
    req.session.productErr = null;

    if (!data || data.length === 0) {
      logger.warn(`Edit product: product not found (ID: ${productid})`);
      return res.redirect('/admin/products');
    }

    let product = data[0];
    if (!product) {
      logger.warn(`Edit product: invalid product data for ID ${productid}`);
      return res.redirect('/admin/products');
    }

    // Handle Decimal128 conversion safely
    if (Array.isArray(product.variantId)) {
      product.variantId = product.variantId.map(v => ({
        ...v,
        price: v.price && typeof v.price === 'object' && v.price.$numberDecimal
          ? v.price.$numberDecimal
          : String(v.price || '0'),
        stock: v.stock != null ? String(v.stock) : '0'
      }));
    }

    return res.status(STATUS_CODE.OK).render('editProduct', {
      product: { data: product },
      categories: categories.options || [],
      error
    });
  } catch (error) {
    logger.error(`Error loading edit product page (ID: ${req.query.productid}): ${error.message}`);
    return res.redirect('/admin/products');
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { productid } = req.params;
    if (!productid) {
      logger.warn('Update product called without product ID');
      return res.status(STATUS_CODE.BAD_REQUEST).redirect('/admin/products');
    }

    await updateProductService(req, productid);
    logger.info(`Product ${productid} updated successfully by admin`);
    return res.status(STATUS_CODE.OK).redirect('/admin/products');
  } catch (error) {
    logger.error(`Error updating product ${req.params.productid}: ${error.message}`);
    return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).redirect('/admin/editProduct');
  }
};

export const productStatus = async (req, res) => {
  try {
    const { productId, variantId } = req.query;

    // if (!productId) {
    //   logger.warn('Toggle product status missing productId');
    //   return res.status(STATUS_CODE.BAD_REQUEST).json({ success: false, error: 'Missing productId' });
    // }

    await toggleStatusProduct(productId, variantId);
    logger.info(`Product status toggled: product=${productId}, variant=${variantId || 'all'}`);

    if (req.headers.accept?.includes('application/json')) {
      return res.json({ success: true });
    }

    return res.redirect(`/admin/products?page=${req.session.productPage || 1}`);
  } catch (error) {
    logger.error(`Error toggling product status (product: ${req.query.productId}, variant: ${req.query.variantId}): ${error.message}`);

    if (req.headers.accept?.includes('application/json')) {
      return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ success: false, error: 'Update failed' });
    }

    return res.redirect('/admin/products?error=1');
  }
};