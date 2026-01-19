import offerModel from "../../models/offerModel.js";
import { availableItems, newOfferData, getFilteredOffers, updateOffer, toggleOffer } from "../../service/admin/offerService.js";
import { STATUS_CODE } from "../../util/statusCodes.js";
import logger from '../../util/logger.js'; // ✅ Adjust path as per your project structure

export const offerDetail = async (req, res) => {
  try {
    const { page = 1, search = '', status = 'all', offerType = 'all' } = req.query;
    const currentPage = parseInt(page) || 1;
    const limit = 5;

    const { offers, totalOffers, totalPages } = await getFilteredOffers({
      page: currentPage,
      limit,
      search,
      status,
      offerType,
    });

    const { products, category } = await availableItems();

    return res.render('offerManagement', {
      offers,
      totalOffers,
      currentPage,
      totalPages,
      search,
      status,
      offerType,
      products,
      category,
    });
  } catch (error) {
    logger.error(`Error in GET /admin/offers (offerDetail): ${error.message}`);
    return res.redirect('/admin/products');
  }
};

export const newOffer = async (req, res) => {
  try {
    const items = await availableItems();
    return res.render('offerAdd', { items });
  } catch (error) {
    logger.error(`Error loading new offer form: ${error.message}`);
    return res.redirect('/admin/products');
  }
};

export const offerAdd = async (req, res) => {
  try {
    await newOfferData(req.body);
    logger.info(`New offer created with data: ${JSON.stringify(req.body)}`);
    return res.status(STATUS_CODE.OK).json({ message: "Offer created successfully!" });
  } catch (error) {
    logger.error(`Error creating new offer: ${error.message}`);
    return res.status(STATUS_CODE.BAD_REQUEST).json({ 
      message: 'Failed to create offer',
      error: error.message 
    });
  }
};

export const offerEdit = async (req, res) => {
  try {
    const offer = await offerModel.findById(req.params.id).lean();
    if (!offer) {
      logger.warn(`Offer edit requested for non-existent ID: ${req.params.id}`);
      return res.status(STATUS_CODE.NOT_FOUND).send('Offer not found');
    }

    const result = await availableItems();

    return res.render('offerEdit', {
      offer,
      items: { products: result.products, category: result.category }
    });
  } catch (error) {
    logger.error(`Error loading offer edit page (ID: ${req.params.id}): ${error.message}`);
    return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).send('Server error');
  }
};

export const offerUpdate = async (req, res) => {
  try {
    const offerId = req.params.offerId;
    await updateOffer(offerId, req.body);
    logger.info(`Offer ${offerId} updated successfully`);
    return res.status(STATUS_CODE.OK).json({
      message: 'Offer updated successfully!'
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => ({
        path: err.path,
        msg: err.message
      }));
      logger.warn(`Validation failed while updating offer ${req.params.offerId}: ${JSON.stringify(errors)}`);
      return res.status(STATUS_CODE.BAD_REQUEST).json({ errors });
    }

    logger.error(`Error updating offer ${req.params.offerId}: ${error.message}`);
    return res.status(STATUS_CODE.BAD_REQUEST).json({
      message: error.message || 'Failed to update offer'
    });
  }
};

export const offerToggle = async (req, res) => {
  try {
    const { offerId } = req.params;
    await toggleOffer(offerId);
    logger.info(`Offer ${offerId} toggled successfully`);
    return res.status(STATUS_CODE.OK).json({ message: "Successfully updated" });
  } catch (error) {
    logger.error(`Error toggling offer ${req.params.offerId}: ${error.message}`);
    return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ 
      error: error.message || 'Failed to toggle offer' 
    });
  }
};