import offerModel from "../../models/offerModel.js";
import { availableItems, newOfferData, getFilteredOffers, updateOffer, toggleOffer } from "../../service/admin/offerService.js";
import { STATUS_CODE } from "../../util/statusCodes.js";

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

    res.render('offerManagement', {
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
    console.log(`Error in offerDetail: ${error}`);
    res.redirect('/admin/products');
  }
};

export const newOffer = async (req, res) => {
  try {
    const items = await availableItems()
    res.render('offerAdd', { items })
  } catch (error) {
    console.log(`error from ${error}`);
    res.redirect('/admin/products')
  }
}

export const offerAdd = async (req, res) => {
  try {
    await newOfferData(req.body)
    return res.status(STATUS_CODE.OK).json({ message: "Offer created successfully!" })
  } catch (error) {
    console.log(`error from offerAdd ${error}`);
    return res.status(STATUS_CODE.BAD_REQUEST).json({ message: 'failed to create offer', error: error.message })
  }
}

export const offerEdit = async (req, res) => {
  try {
    const offer = await offerModel.findById(req.params.id).lean();
    if (!offer) return res.status(404).send('Offer not found');

    const result = await availableItems()

    res.render('offerEdit', {
      offer,
      items: { products: result.products, category: result.category }
    });
  } catch (error) {
    console.error(error);
    res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).send('Server error');
  }
};

export const offerUpdate = async (req, res) => {
  try {
    const offerId = req.params.offerId;
    await updateOffer(offerId, req.body);

    return res.status(STATUS_CODE.OK).json({
      message: 'Offer updated successfully!'
    });
  } catch (error) {
    console.error('Error in offerUpdate:', error.message);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => ({
        path: err.path,
        msg: err.message
      }));
      return res.status(STATUS_CODE.BAD_REQUEST).json({ errors });
    }

    return res.status(STATUS_CODE.BAD_REQUEST).json({
      message: error.message || 'Failed to update offer'
    });
  }
};

export const offerToggle = async (req, res) => {
  try {
    const { offerId } = req.params;
    await toggleOffer(offerId);

    res.status(200).json({ message: "Successfully updated" });
  } catch (error) {
    console.error(`Error in offerToggle:`, error.message);
    res.status(500).json({ error: error.message || 'Failed to toggle offer' });
  }
};