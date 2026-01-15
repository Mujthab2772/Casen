import orderModal from "../../models/orderModel.js";
import userModel from "../../models/userModel.js";
import { Product } from "../../models/productModel.js";
import { ProductVariant } from "../../models/productVariantModel.js";
import couponModal from '../../models/couponModel.js';
import offerModal from '../../models/offerModel.js';
import mongoose from 'mongoose';

export const dashboardDetails = async (page = 1, limit = 5) => {
  try {
    const skip = (page - 1) * limit;
    
    const totalRevenue = await orderModal.aggregate([
      {
        $match: { 
          orderStatus: { $nin: ['cancelled', 'returned'] }, 
          paymentStatus: 'paid',
          subTotal: { $gte: 0 }
        }
      },
      { $group: { _id: 0, totalrevenue: { $sum: '$subTotal' } } }
    ]);
    
    const totalOrdersCount = await orderModal.countDocuments({});
    
    const orderDetails = await orderModal.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    const totalOrders = await orderModal.countDocuments();
    const totalUsers = await userModel.countDocuments();
    
    const productsWithStock = await Product.aggregate([
      {
        $lookup: {
          from: "productvariants",
          localField: "variantId",
          foreignField: "_id",
          as: "variants"
        }
      },
      {
        $match: {
          "variants.stock": { $gt: 0 },
          "variants.isActive": true,
          isActive: true
        }
      },
      { $count: "count" }
    ]);
    
    const outOfStockProducts = await Product.aggregate([
      {
        $lookup: {
          from: "productvariants",
          localField: "variantId",
          foreignField: "_id",
          as: "variants"
        }
      },
      {
        $match: {
          $and: [
            { isActive: true },
            { 
              $expr: {
                $eq: [
                  { 
                    $filter: {
                      input: "$variants",
                      as: "variant",
                      cond: { $and: [
                        { $gt: ["$$variant.stock", 0] },
                        { $eq: ["$$variant.isActive", true] }
                      ]}
                    }
                  },
                  []
                ]
              }
            }
          ]
        }
      },
      { $count: "count" }
    ]);
    
    const totalPages = Math.ceil(totalOrdersCount / limit);
    
    return { 
      totalRevenue, 
      totalOrders, 
      totalUsers, 
      orderDetails,
      productsInStock: productsWithStock[0]?.count || 0,
      outOfStockProducts: outOfStockProducts[0]?.count || 0,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: totalOrdersCount,
        itemsPerPage: limit
      }
    };
  } catch (error) {
    console.log(`error from dashboardDetails ${error}`);
    throw error;
  }
};

export const salesReportService = {
  async getSummaryMetrics(filters = {}) {
    try {
      const dateFilter = this.buildDateFilter(filters);

      const summary = await orderModal.aggregate([
        { $match: { ...dateFilter, orderStatus: { $in: ['delivered', 'shipped'] } } },
        {
          $group: {
            _id: null,
            totalSales: { $sum: "$totalAmount" },
            totalOrders: { $sum: 1 },
            totalDiscount: { $sum: "$discountAmount" },
            subTotal: { $sum: "$subTotal" },
            taxAmount: { $sum: "$taxAmount" }
          }
        }
      ]);

      const previousPeriodSummary = await this.getPreviousPeriodSummary(dateFilter);

      return {
        totalSales: summary[0]?.totalSales || 0,
        totalOrders: summary[0]?.totalOrders || 0,
        totalDiscount: summary[0]?.totalDiscount || 0,
        grossSales: (summary[0]?.subTotal || 0) + (summary[0]?.taxAmount || 0),
        changes: {
          totalSales: this.calculatePercentageChange(summary[0]?.totalSales || 0, previousPeriodSummary.totalSales),
          totalOrders: this.calculatePercentageChange(summary[0]?.totalOrders || 0, previousPeriodSummary.totalOrders),
          totalDiscount: this.calculatePercentageChange(summary[0]?.totalDiscount || 0, previousPeriodSummary.totalDiscount),
          grossSales: this.calculatePercentageChange(
            (summary[0]?.subTotal || 0) + (summary[0]?.taxAmount || 0), 
            previousPeriodSummary.grossSales
          )
        }
      };
    } catch (error) {
      console.error('Error in getSummaryMetrics:', error);
      throw new Error(`Error fetching summary metrics: ${error.message}`);
    }
  },

  async getSalesReportDetails(filters = {}, page = 1, limit = 10) {
    try {
      const { period = 'weekly' } = filters;
      const dateFilter = this.buildDateFilter(filters);
      
      let groupConfig = {};
      let sortConfig = {};
      
      switch (period) {
        case 'daily':
          groupConfig = {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          };
          sortConfig = { "_id.date": -1 };
          break;
        case 'weekly':
          groupConfig = {
            week: { $week: "$createdAt" },
            year: { $year: "$createdAt" }
          };
          sortConfig = { "_id.year": -1, "_id.week": -1 };
          break;
        case 'monthly':
          groupConfig = {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" }
          };
          sortConfig = { "_id.year": -1, "_id.month": -1 };
          break;
        case 'yearly':
          groupConfig = {
            year: { $year: "$createdAt" }
          };
          sortConfig = { "_id.year": -1 };
          break;
        default:
          groupConfig = {
            week: { $week: "$createdAt" },
            year: { $year: "$createdAt" }
          };
          sortConfig = { "_id.year": -1, "_id.week": -1 };
      }

      const totalCountPipeline = [
        { $match: { ...dateFilter, orderStatus: { $in: ['delivered', 'shipped'] } } },
        {
          $group: {
            _id: groupConfig
          }
        },
        { $count: "total" }
      ];
      
      const totalCountResult = await orderModal.aggregate(totalCountPipeline);
      const totalItems = totalCountResult[0]?.total || 0;
      const totalPages = Math.ceil(totalItems / limit);
      const skip = (page - 1) * limit;

      const reportData = await orderModal.aggregate([
        { $match: { ...dateFilter, orderStatus: { $in: ['delivered', 'shipped'] } } },
        {
          $group: {
            _id: groupConfig,
            orders: { $sum: 1 },
            grossSales: { 
              $sum: { 
                $add: [
                  "$subTotal", 
                  { $ifNull: ["$taxAmount", 0] }
                ] 
              } 
            },
            discounts: { $sum: { $ifNull: ["$discountAmount", 0] } },
            netSales: { $sum: { $ifNull: ["$totalAmount", 0] } },
            couponData: { 
              $push: { 
                couponCode: "$appliedCoupon.couponCode", 
                discountAmount: "$appliedCoupon.discountAmount" 
              } 
            }
          }
        },
        { $sort: sortConfig },
        { $skip: skip },
        { $limit: limit }
      ]);

      return {
        period,
        currentPage: page,
        totalPages: totalPages,
        totalItems: totalItems,
        itemsPerPage: limit,
        reportData: this.formatReportData(reportData, period),
      };
    } catch (error) {
      console.error('Error in getSalesReportDetails:', error);
      throw new Error(`Error fetching sales report details: ${error.message}`);
    }
  },

  async getCouponAnalysis(filters = {}) {
    try {
      const dateFilter = this.buildDateFilter(filters);
      
      const couponUsage = await orderModal.aggregate([
        { $match: { 
          ...dateFilter, 
          orderStatus: { $in: ['delivered', 'shipped'] },
          "appliedCoupon.couponId": { $exists: true, $ne: null },
          "appliedCoupon.discountAmount": { $gt: 0 }
        } },
        {
          $group: {
            _id: "$appliedCoupon.couponCode",
            usageCount: { $sum: 1 },
            totalDiscount: { $sum: "$appliedCoupon.discountAmount" }
          }
        }
      ]);

      const couponCodes = [...new Set(couponUsage.map(c => c._id))];
      let couponDetails = [];
      
      if (couponCodes.length > 0) {
        couponDetails = await couponModal.find({ couponCode: { $in: couponCodes } }).lean();
      }
      
      return couponUsage.map(coupon => {
        const details = couponDetails.find(d => d.couponCode === coupon._id);
        
        let description = 'No details available';
        if (details) {
          if (details.discountType === 'percentage') {
            description = `${details.discountAmount}% off${details.minAmount ? ` on orders above $${details.minAmount}` : ''}`;
          } else {
            description = `$${details.discountAmount} off${details.minAmount ? ` on orders above $${details.minAmount}` : ''}`;
          }
        }
        
        return {
          code: coupon._id || 'Unknown',
          description,
          usageCount: coupon.usageCount || 0,
          totalDiscount: coupon.totalDiscount || 0,
          avgDiscountPerUse: coupon.usageCount > 0 ? coupon.totalDiscount / coupon.usageCount : 0,
          status: details?.isActive ? 'active' : 'inactive'
        };
      });
    } catch (error) {
      console.error('Error in getCouponAnalysis:', error);
      return [];
    }
  },

  async getProductSalesData(filters = {}) {
    try {
      const dateFilter = this.buildDateFilter(filters);
      
      const pipeline = [
        { $match: { ...dateFilter, orderStatus: { $in: ['delivered', 'shipped'] } } },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.productId",
            productName: { $first: "$items.productName" },
            totalQuantity: { $sum: "$items.quantity" }
          }
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: 6 } // Limit to top 6 products for the chart
      ];

      const productSales = await orderModal.aggregate(pipeline);
      
      const labels = productSales.map(item => item.productName || 'Unknown Product');
      const data = productSales.map(item => item.totalQuantity || 0);
      
      // Generate colors dynamically based on the number of products
      const backgroundColors = [];
      const borderColors = [];
      const baseColors = [
        '#0ea5e9', // blue-500
        '#38bdf8', // blue-400
        '#7dd3fc', // blue-300
        '#bae6fd', // blue-200
        '#e0f2fe', // blue-100
        '#f0f9ff'  // blue-50
      ];
      
      for (let i = 0; i < labels.length; i++) {
        backgroundColors.push(baseColors[i % baseColors.length]);
        borderColors.push('#0284c7'); // blue-700
      }
      
      return {
        labels,
        data,
        backgroundColors,
        borderColors
      };
    } catch (error) {
      console.error('Error fetching product sales data:', error);
      return {
        labels: ['No Data'],
        data: [0],
        backgroundColors: ['#e5e7eb'], // gray-300
        borderColors: ['#9ca3af']     // gray-400
      };
    }
  },

  buildDateFilter(filters) {
    const { reportPeriod = 'last7days', startDate, endDate } = filters;
    
    if ((reportPeriod === 'custom' || reportPeriod.includes('custom')) && startDate && endDate) {
      const start = new Date(startDate);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999); 
      
      const today = new Date();
      today.setUTCHours(23, 59, 59, 999);
      
      if (start > today) start = today;
      if (end > today) end = today;
      
      if (start > end) {
        const temp = start;
        start = end;
        end = temp;
      }
      
      return {
        createdAt: {
          $gte: start,
          $lte: end
        }
      };
    }
    
    const now = new Date();
    now.setUTCHours(23, 59, 59, 999); 
    let startDateObj = new Date();
    
    switch (reportPeriod) {
      case 'today':
        startDateObj = new Date();
        startDateObj.setUTCHours(0, 0, 0, 0);
        break;
      case 'last7days':
        startDateObj = new Date();
        startDateObj.setDate(now.getDate() - 6); 
        startDateObj.setUTCHours(0, 0, 0, 0);
        break;
      case 'last30days':
        startDateObj = new Date();
        startDateObj.setDate(now.getDate() - 29); 
        startDateObj.setUTCHours(0, 0, 0, 0);
        break;
      case 'thismonth':
        startDateObj = new Date(now.getFullYear(), now.getMonth(), 1);
        startDateObj.setUTCHours(0, 0, 0, 0);
        break;
      case 'thisyear':
        startDateObj = new Date(now.getFullYear(), 0, 1);
        startDateObj.setUTCHours(0, 0, 0, 0);
        break;
      default:
        startDateObj = new Date();
        startDateObj.setDate(now.getDate() - 6);
        startDateObj.setUTCHours(0, 0, 0, 0);
    }
    
    return {
      createdAt: {
        $gte: startDateObj,
        $lte: now
      }
    };
  },

  calculatePercentageChange(currentValue, previousValue) {
    if (previousValue === 0 && currentValue === 0) return 0;
    if (previousValue === 0) return currentValue > 0 ? 100 : -100;
    return ((currentValue - previousValue) / previousValue) * 100;
  },

  async getPreviousPeriodSummary(dateFilter) {
    try {
      const startDate = dateFilter.createdAt.$gte;
      const endDate = dateFilter.createdAt.$lte;
      
      const periodDuration = endDate.getTime() - startDate.getTime();
      
      const prevEndDate = new Date(startDate.getTime() - 1); 
      const prevStartDate = new Date(prevEndDate.getTime() - periodDuration);
      
      const minDate = new Date(2000, 0, 1);
      if (prevStartDate < minDate) prevStartDate = minDate;
      
      const summary = await orderModal.aggregate([
        { 
          $match: { 
            createdAt: { $gte: prevStartDate, $lte: prevEndDate },
            orderStatus: { $in: ['delivered', 'shipped'] } 
          } 
        },
        {
          $group: {
            _id: null,
            totalSales: { $sum: { $ifNull: ["$totalAmount", 0] } },
            totalOrders: { $sum: 1 },
            totalDiscount: { $sum: { $ifNull: ["$discountAmount", 0] } },
            subTotal: { $sum: { $ifNull: ["$subTotal", 0] } },
            taxAmount: { $sum: { $ifNull: ["$taxAmount", 0] } }
          }
        }
      ]);
      
      return {
        totalSales: summary[0]?.totalSales || 0,
        totalOrders: summary[0]?.totalOrders || 0,
        totalDiscount: summary[0]?.totalDiscount || 0,
        grossSales: (summary[0]?.subTotal || 0) + (summary[0]?.taxAmount || 0)
      };
    } catch (error) {
      console.error('Error getting previous period summary:', error);
      return { totalSales: 0, totalOrders: 0, totalDiscount: 0, grossSales: 0 };
    }
  },

  formatReportData(reportData, period) {
    if (!reportData || reportData.length === 0) {
      return [{
        datePeriod: 'No data available',
        orders: 0,
        grossSales: 0,
        discounts: 0,
        couponsApplied: 0,
        netSales: 0,
        avgOrderValue: 0
      }];
    }
    
    return reportData.map(item => {
      let datePeriod = '';
      
      switch (period) {
        case 'daily':
          datePeriod = item._id.date ? item._id.date : 'Unknown date';
          break;
        case 'weekly':
          const firstDayOfYear = new Date(item._id.year, 0, 1);
          const daysOffset = ((item._id.week - 1) * 7) + (firstDayOfYear.getDay() <= 4 ? -firstDayOfYear.getDay() + 1 : 8 - firstDayOfYear.getDay());
          
          const startDate = new Date(item._id.year, 0, 1 + daysOffset);
          const endDate = new Date(item._id.year, 0, 8 + daysOffset);
          
          const options = { month: 'short', day: 'numeric' };
          const startDateStr = startDate.toLocaleDateString('en-US', options);
          const endDateStr = endDate.toLocaleDateString('en-US', options);
          
          datePeriod = `${startDateStr} - ${endDateStr}, ${item._id.year}`;
          break;
        case 'monthly':
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const monthIndex = item._id.month - 1;
          datePeriod = `${monthNames[monthIndex >= 0 && monthIndex < 12 ? monthIndex : 0]} ${item._id.year}`;
          break;
        case 'yearly':
          datePeriod = `${item._id.year || 'Unknown year'}`;
          break;
        default:
          datePeriod = 'Unknown period';
      }
      
      let couponsApplied = 0;
      if (item.couponData && Array.isArray(item.couponData)) {
        couponsApplied = item.couponData
          .filter(c => c && c.couponCode && c.discountAmount)
          .reduce((sum, c) => sum + (parseFloat(c.discountAmount) || 0), 0);
      }
      
      return {
        datePeriod,
        orders: item.orders || 0,
        grossSales: item.grossSales || 0,
        discounts: item.discounts || 0,
        couponsApplied: couponsApplied || 0,
        netSales: item.netSales || 0,
        avgOrderValue: item.orders > 0 ? (item.netSales || 0) / item.orders : 0
      };
    });
  }
};