import mongoose from "mongoose";
import Wishlist from "../../models/wishlist.js";
import { productDetailsFilter } from "../../service/user/landingpageService.js";
import { productDetails, singleProductFetch } from "../../service/user/productService.js";
import { STATUS_CODE } from "../../util/statusCodes.js";
import logger from '../../util/logger.js'; // ✅ Add logger import

export const fetchProducts = async (req, res) => {
    try {
        const {
            search = '',
            sort = 'bestselling',
            minPrice,
            maxPrice,
            category,
            product,
            color,
            page = 1,
            limit = 9
        } = req.query;
        
        const parsedPage = Math.max(1, parseInt(page) || 1);
        const parsedLimit = Math.min(100, parseInt(limit) || 10);
        
        const result = await productDetails({
            search: search.trim(),
            sort,
            minPrice: minPrice ? parseFloat(minPrice) : undefined,
            maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
            category: category || undefined,
            product: product || undefined,
            color: color || undefined,
            page: parsedPage,
            limit: parsedLimit
        });
        
        return res.render('products', {
            products: result.data || [],
            pagination: result.pagination || { currentPage: 1, totalPages: 1, total: 0, hasNext: false, hasPrev: false },
            query: req.query || {},
            user: req.session?.userDetail,
            filterCategories: result.allCategories.map(c => c.categoryName).filter(Boolean),
            filterProducts: result.allproducts.filter(Boolean)
        });
    } catch (error) {
        logger.error(`Error from fetchProducts: ${error.message}`);
        return res.redirect('/');
    }
};

export const singleProduct = async (req, res) => {
    try {
        const productId = req.query.product;
        if (!productId) return res.status(STATUS_CODE.BAD_REQUEST).redirect('/products');
        
        const user = req.session.userDetail;
        const result = await singleProductFetch(productId);
        const products = await productDetailsFilter();
        
        let wishlistVariantIds = [];
        if (user) {
            const userId = new mongoose.Types.ObjectId(user._id);
            const wishlistItems = await Wishlist.find({ 
                userId, 
                productId: new mongoose.Types.ObjectId(result?._id) 
            });
            wishlistVariantIds = wishlistItems.map(item => item.variantId.toString());
        }
        
        if (!result) return res.status(STATUS_CODE.NOT_FOUND).redirect('/products');
        if (!result.variants || result.variants.length === 0) return res.status(STATUS_CODE.NOT_FOUND).redirect('/products');

        return res.render('singleProduct', { 
            product: result, 
            user,
            wishlistVariantIds,
            allproducts: products
        });
    } catch (error) {
        logger.error(`Error from singleProduct: ${error.message}`);
        return res.redirect('/products');
    }
};