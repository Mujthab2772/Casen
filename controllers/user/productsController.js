import { productDetails, singleProductFetch } from "../../service/user/productService.js"
import { STATUS_CODE } from "../../util/statusCodes.js";

export const fetchProducts = async (req, res) => {
    try {
        const {
            search = '',
            sort= 'bestselling',
            minPrice,
            maxPrice,
            category,
            product,
            color,
            page = 1,
            limit = 10
        } = req.query

        const parsedPage = Math.max(1, parseInt(page) || 1)
        const parsedLimit = Math.min(100, parseInt(limit) || 10)


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
        })

        res.render('products', {
            products: result.data || [],
            pagination: result.pagination || { currentPage: 1, totalPages: 1, total: 0, hasNext: false, hasPrev: false },
            query: req.query || {},
            user: req.session.userDetail
        })
    } catch (error) {
        console.log(`error from fetchproducts ${error}`);
    }
}


export const singleProduct = async (req, res) => {
    try {
        const productId = (req.query.product)

        if(!productId) return res.status(STATUS_CODE.BAD_REQUEST).redirect('/products')

        const result = await singleProductFetch(productId)

        if(!result) return res.status(STATUS_CODE.BAD_REQUEST).redirect('/products')

        // console.log(result)
        res.render('singleProduct', {product: result, user: req.session.userDetail})
    } catch (error) {
        console.log(`error from singleProduct ${error}`);
        res.redirect('/products')
    }
}