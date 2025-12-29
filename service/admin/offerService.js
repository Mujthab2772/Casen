import categoryModel from "../../models/categoryModel.js"
import offerModel from "../../models/offerModel.js"
import { Product } from "../../models/productModel.js"
import {v4 as uuidv} from 'uuid'
 

const todayStart = new Date();
todayStart.setHours(0, 0, 0, 0);

export const availableItems = async () => {
  try {
    const products = await Product.find({ isActive: true })
    const category = await categoryModel.find({ isValid: true })
    return { products, category };
  } catch (error) {
    console.log(`Error from availableItems: ${error}`);
    throw error;
  }
};

export const getFilteredOffers = async ({ page, limit, search, status, offerType }) => {
  const now = new Date();
  const skip = (page - 1) * limit;
  const query = {};

  if (search) {
    query.offerName = { $regex: search, $options: 'i' };
  }

  if (offerType && offerType !== 'all') {
    let targetingType;
    if (offerType === 'product') targetingType = 'products';
    else if (offerType === 'category') targetingType = 'categories';
    else if (offerType === 'global') targetingType = 'all';
    query.targetingType = targetingType;
  }

  if (status && status !== 'all') {
    if (status === 'active') {
      query.$and = [
        { status: 'active' },
        { startDate: { $lte: now } },
        { endDate: { $gt: now } },
      ];
    } else if (status === 'inactive') {
      query.status = 'inactive';
    } else if (status === 'expired') {
      query.$and = [
        { status: 'active' },
        { endDate: { $lt: now } },
      ];
    }
  }

  const totalOffers = await offerModel.countDocuments(query);

  const offers = await offerModel.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalPages = Math.ceil(totalOffers / limit);

  return {
    offers,
    totalOffers,
    totalPages,
    currentPage: page,
  };
};

export const newOfferData = async(offerDetail) => {
    try {
        const {
            offerName, 
            offerType, 
            discountValue, 
            startDate, 
            endDate, 
            status = 'active', 
            minPurchase = 0, 
            applicableType, 
            selectedProducts = [],
            selectedCategories = [], 
        } = offerDetail


        let targetingType
        if(applicableType === 'all'){
            targetingType = 'all'
        } else if(applicableType === 'products') {
            targetingType = 'products'
        } else if(applicableType === 'categories') {
            targetingType = 'categories'
        } else {
            throw new Error('Invalid applicableType')
        }

        const offer = new offerModel({
            offerId: uuidv(),
            offerName,
            offerType,
            discountValue: Number(discountValue),
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            minPurchase: Number(minPurchase),
            status,
            targetingType,
            'targeting.productIds': (targetingType === 'products') ? selectedProducts : [],
            'targeting.categoryIds': (targetingType === 'categories') ? selectedCategories : []
        })

        await offer.save()
        return offer
    } catch (error) {
        console.log(`error from newOfferData ${error}`);
        throw error
    }
}

// service
export const updateOffer = async (offerId, offerDetails) => {
  try {
    const offer = await offerModel.findById({_id: offerId});
    if (!offer) {
      throw new Error('Offer not found');
    }

    offer.offerType = offerDetails.offerType;
    offer.discountValue = offerDetails.discountValue;
    offer.startDate = offerDetails.startDate;
    offer.endDate = offerDetails.endDate;
    offer.minPurchase = offerDetails.minPurchase;
    offer.status = offerDetails.status;
    offer.targetingType = offerDetails.applicableType;

    if (offerDetails.applicableType === 'products') {
      offer.targeting.productIds = offerDetails.selectedProducts || [];
      offer.targeting.categoryIds = [];
    } else if (offerDetails.applicableType === 'categories') {
      offer.targeting.categoryIds = offerDetails.selectedCategories || [];
      offer.targeting.productIds = [];
    } else {
      offer.targeting.productIds = [];
      offer.targeting.categoryIds = [];
    }

    await offer.save();
    return offer;
  } catch (error) {
    console.log(`Error in updateOffer:`, error);
    throw error; 
  }
};


export const toggleOffer = async (offerId) => {
  try {
    const offer = await offerModel.findById({_id: offerId}); // no need for { _id: ... }
    if (!offer) {
      throw new Error('Offer not found');
    }

    offer.status = offer.status === 'active' ? 'inactive' : 'active';
    await offer.save();
    return offer;
  } catch (error) {
    console.log(`error from toggleOffer:`, error);
    throw error;
  }
};
