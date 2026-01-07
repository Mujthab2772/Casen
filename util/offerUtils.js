import mongoose from 'mongoose';

export const applyOffersToProducts = async (products, activeOffers) => {
  if (!activeOffers || activeOffers.length === 0) {
    // No active offers, just calculate totals
    return products.map(item => {
      if (item.products && item.products.variant && item.products.product) {
        item.products.total = (item.products.variant.price * item.products.quantity).toFixed(2);
      }
      return item;
    });
  }
  
  return products.map(item => {
    if (item.products && item.products.variant && item.products.product) {
      const productIdStr = item.products.product._id.toString();
      const categoryIdStr = item.products.product.categoryId 
        ? item.products.product.categoryId.toString() 
        : '';
      
      // Apply offers to the variant
      item.products.variant = applyOfferToVariant(
        item.products.variant,
        productIdStr,
        categoryIdStr,
        activeOffers,
        item.products.product.productName
      );
      
      // Calculate total with discounted price
      item.products.total = (item.products.variant.price * item.products.quantity).toFixed(2);
    }
    return item;
  });
};

export const applyOfferToVariant = (variant, productIdStr, categoryIdStr, activeOffers, productName) => {
  if (!variant || !variant.price || variant.price <= 0) {
    return variant;
  }
  
  // Ensure price is a number
  const originalPrice = parseFloat(variant.price.toString());
  const productOffers = activeOffers.filter(offer =>
    offer.targetingType === 'products' &&
    offer.targeting.productIds.some(id => id.toString() === productIdStr)
  );
  
  const categoryOffers = activeOffers.filter(offer =>
    offer.targetingType === 'categories' &&
    offer.targeting.categoryIds.some(id => id.toString() === categoryIdStr)
  );
  
  const globalOffers = activeOffers.filter(offer =>
    offer.targetingType === 'all'
  );
  
  let bestOffer = null;
  
  // Prioritize specific offers (product or category) over global offers
  if (productOffers.length > 0 || categoryOffers.length > 0) {
    const specificOffers = [...productOffers, ...categoryOffers].filter(Boolean);
    if (specificOffers.length > 0) {
      bestOffer = specificOffers.reduce((best, current) => {
        if (!best) return current;
        
        const bestValue = best.offerType === 'percentage'
          ? best.discountValue
          : (best.discountValue / originalPrice) * 100;
          
        const currentValue = current.offerType === 'percentage'
          ? current.discountValue
          : (current.discountValue / originalPrice) * 100;
          
        return currentValue > bestValue ? current : best;
      }, null);
    }
  } 
  // Use global offer only if no specific offers available
  else if (globalOffers.length > 0) {
    bestOffer = globalOffers.reduce((best, current) => {
      if (!best) return current;
      
      const bestValue = best.offerType === 'percentage'
        ? best.discountValue
        : (best.discountValue / originalPrice) * 100;
        
      const currentValue = current.offerType === 'percentage'
        ? current.discountValue
        : (current.discountValue / originalPrice) * 100;
        
      return currentValue > bestValue ? current : best;
    }, null);
  }
  
  // Create a copy of the variant to avoid modifying the original
  const updatedVariant = { 
    ...variant, 
    originalPrice: originalPrice,
    hasOffer: false,
    offerInfo: null
  };
  
  // Apply the best offer if found
  if (bestOffer) {
    let discountAmount = 0;
    let finalPrice = originalPrice;
    
    if (bestOffer.offerType === 'percentage') {
      discountAmount = (originalPrice * bestOffer.discountValue) / 100;
      finalPrice = originalPrice - discountAmount;
    } else if (bestOffer.offerType === 'fixed') {
      discountAmount = Math.min(bestOffer.discountValue, originalPrice);
      finalPrice = originalPrice - discountAmount;
    }
    
    finalPrice = Math.max(0, finalPrice);
    
    updatedVariant.offerInfo = {
      offerId: bestOffer._id.toString(),
      offerName: bestOffer.offerName,
      offerType: bestOffer.offerType,
      discountValue: bestOffer.discountValue,
      discountPercentage: bestOffer.offerType === 'percentage'
        ? bestOffer.discountValue
        : (discountAmount / originalPrice) * 100,
      originalPrice: originalPrice,
      discountAmount: discountAmount,
      finalPrice: finalPrice
    };
    
    updatedVariant.originalPrice = originalPrice;
    updatedVariant.price = finalPrice;
    updatedVariant.hasOffer = true;
  }
  
  return updatedVariant;
};