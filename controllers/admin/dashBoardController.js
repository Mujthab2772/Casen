import { dashboardDetails, salesReportService } from "../../service/admin/dashBoardService.js";
import pdf from 'pdfkit';
import ExcelJS from 'exceljs'
import { STATUS_CODE } from "../../util/statusCodes.js";
import logger from '../../util/logger.js'; // ✅ Adjust path as per your project structure

export const dashboard = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const period = req.query.period || 'daily';

    const info = await dashboardDetails(page, period);

    const salesData = {
      daily: info.dailySales.map(item => ({ date: item._id.date, total: item.totalSales })),
      monthly: info.monthlySales.map(item => ({ year: item._id.year, month: item._id.month, total: item.totalSales })),
      yearly: info.yearlySales.map(item => ({ year: item._id.year, total: item.totalSales }))
    };

    const bestSellingProducts = info.bestSellingProducts.map(product => ({
      productName: product.productName,
      totalQuantity: product.totalQuantity,
      totalRevenue: product.totalRevenue,
      images: product.images || []
    }));

    const bestSellingCategories = info.bestSellingCategories.map(category => ({
      categoryName: category.categoryName,
      totalProducts: category.totalProducts,
      totalRevenue: category.totalRevenue
    }));

    return res.render('dashBoard', {
      totalRevenue: info.totalRevenue[0]?.totalrevenue?.toFixed(2) || 0,
      totalOrder: info.totalOrders,
      totalUser: info.totalUsers,
      productsInStock: info.productsInStock,
      outOfStockProducts: info.outOfStockProducts,
      orderDetail: info.orderDetails,
      pagination: info.pagination,
      salesData,
      bestSellingProducts,
      bestSellingCategories
    });
  } catch (error) {
    logger.error(`Error loading admin dashboard: ${error.message}`);
    return res.redirect('/admin/products');
  }
};

// PDF correct

export const salesReportController = {
    /**
     * Render the sales report page with analytics data
     */
    async getSalesReportPage(req, res) {
        try {
            const {
                reportPeriod = 'last7days',
                startDate,
                endDate,
                view = 'weekly',
                page = 1,
                limit = 5,
                ordersPage = 1,
                ordersLimit = 10
            } = req.query;
            
            // Normalize and validate period
            let normalizedPeriod = reportPeriod.toLowerCase().replace(/\s+/g, '');
            if (normalizedPeriod.includes('custom')) normalizedPeriod = 'custom';
            let validStartDate = startDate;
            let validEndDate = endDate;
            
            // Set default date range
            const today = new Date();
            const defaultEndDate = today.toISOString().split('T')[0];
            const lastWeek = new Date(today);
            lastWeek.setDate(today.getDate() - 6);
            const defaultStartDate = lastWeek.toISOString().split('T')[0];
            
            // Handle custom date range validation
            if (normalizedPeriod === 'custom') {
                if (!startDate || !endDate) {
                    validStartDate = defaultStartDate;
                    validEndDate = defaultEndDate;
                } else if (new Date(endDate) < new Date(startDate)) {
                    [validStartDate, validEndDate] = [endDate, startDate]; // swap dates
                } else if (new Date(startDate) > today || new Date(endDate) > today) {
                    validStartDate = defaultStartDate;
                    validEndDate = defaultEndDate;
                }
            }
            
            const normalizedView = view.toLowerCase().replace(/\s+/g, '');
            
            // Build filters object
            const filters = {
                reportPeriod: normalizedPeriod,
                startDate: validStartDate,
                endDate: validEndDate,
                period: normalizedView
            };
            
            // Fetch report data concurrently
            const [
                summary,
                reportDetails,
                couponAnalysis,
                productSalesData,
                detailedOrders
            ] = await Promise.all([
                salesReportService.getSummaryMetrics(filters),
                salesReportService.getSalesReportDetails(filters, parseInt(page), parseInt(limit)),
                salesReportService.getCouponAnalysis(filters),
                salesReportService.getProductSalesData(filters).catch(error => {
                    logger.warn(`Failed to fetch product sales data for report: ${error.message}`);
                    return {
                        labels: ['No Data'],
                        data: [0],
                        backgroundColors: ['#e5e7eb'],
                        borderColors: ['#9ca3af']
                    };
                }),
                salesReportService.getDetailedOrders(filters, parseInt(ordersPage), parseInt(ordersLimit))
            ]);
            
            // Handle empty report data
            if (reportDetails.reportData.length === 0) {
                const emptyReportData = [{
                    datePeriod: filters.startDate && filters.endDate
                        ? `${new Date(filters.startDate).toLocaleDateString()} - ${new Date(filters.endDate).toLocaleDateString()}`
                        : 'No data available',
                    orders: 0,
                    grossSales: 0,
                    discounts: 0,
                    couponsApplied: 0,
                    netSales: 0,
                    avgOrderValue: 0
                }];
                reportDetails.reportData = emptyReportData;
            }
            
            // Format data for presentation
            const formattedData = {
                summary: {
                    totalSales: (summary.totalSales || 0).toFixed(2),
                    totalOrders: summary.totalOrders,
                    totalDiscount: summary.totalDiscount.toFixed(2),
                    changes: {
                        totalSales: {
                            value: Math.abs(summary.changes.totalSales).toFixed(1),
                            isPositive: summary.changes.totalSales > 0
                        },
                        totalOrders: {
                            value: Math.abs(summary.changes.totalOrders).toFixed(1),
                            isPositive: summary.changes.totalOrders > 0
                        },
                        totalDiscount: {
                            value: Math.abs(summary.changes.totalDiscount).toFixed(1),
                            isPositive: summary.changes.totalDiscount < 0
                        }
                    }
                },
                reportDetails: {
                    period: reportDetails.period,
                    data: reportDetails.reportData.map(item => ({
                        ...item,
                        grossSales: typeof item.grossSales === 'number'
                            ? parseFloat(item.grossSales).toFixed(2)
                            : '0.00',
                        discounts: typeof item.discounts === 'number'
                            ? parseFloat(item.discounts).toFixed(2)
                            : '0.00',
                        netSales: typeof item.netSales === 'number'
                            ? parseFloat(item.netSales).toFixed(2)
                            : '0.00',
                        avgOrderValue: typeof item.avgOrderValue === 'number'
                            ? parseFloat(item.avgOrderValue).toFixed(2)
                            : '0.00',
                        couponsApplied: typeof item.couponsApplied === 'number'
                            ? parseFloat(item.couponsApplied).toFixed(2)
                            : '0.00'
                    })),
                    totals: {
                        orders: reportDetails.reportData.reduce((sum, item) => sum + (item.orders || 0), 0),
                        grossSales: reportDetails.reportData.reduce((sum, item) => sum + parseFloat(item.grossSales || 0), 0).toFixed(2),
                        discounts: reportDetails.reportData.reduce((sum, item) => sum + parseFloat(item.discounts || 0), 0).toFixed(2),
                        netSales: reportDetails.reportData.reduce((sum, item) => sum + parseFloat(item.netSales || 0), 0).toFixed(2),
                        couponsApplied: reportDetails.reportData.reduce((sum, item) => sum + parseFloat(item.couponsApplied || 0), 0).toFixed(2),
                        avgOrderValue: (() => {
                            const totalNetSales = reportDetails.reportData.reduce((sum, item) => sum + parseFloat(item.netSales || 0), 0);
                            const totalOrders = reportDetails.reportData.reduce((sum, item) => sum + (item.orders || 0), 0);
                            return totalOrders > 0 ? (totalNetSales / totalOrders).toFixed(2) : '0.00';
                        })()
                    }
                },
                couponAnalysis: couponAnalysis.map(coupon => ({
                    ...coupon,
                    totalDiscount: typeof coupon.totalDiscount === 'number'
                        ? parseFloat(coupon.totalDiscount).toFixed(2)
                        : '0.00',
                    avgDiscountPerUse: typeof coupon.avgDiscountPerUse === 'number'
                        ? parseFloat(coupon.avgDiscountPerUse).toFixed(2)
                        : '0.00'
                })),
                productSales: productSalesData,
                filters: {
                    selectedPeriod: normalizedPeriod,
                    startDate: validStartDate || '',
                    endDate: validEndDate || '',
                    selectedView: normalizedView
                },
                pagination: {
                    currentPage: reportDetails.currentPage,
                    totalPages: reportDetails.totalPages,
                    totalItems: reportDetails.totalItems,
                    itemsPerPage: reportDetails.itemsPerPage
                },
                detailedOrders: {
                    orders: detailedOrders.orders.map(order => ({
                        ...order,
                        totalAmount: parseFloat(order.totalAmount).toFixed(2)
                    })),
                    pagination: detailedOrders.pagination
                }
            };
            
            return res.render('analytics', { title: 'Sales Reports', data: formattedData });
        } catch (error) {
            logger.error(`Error in GET /admin/sales-report: ${error.message}`, error);
            return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).send('Error generating sales report');
        }
    },

    /**
     * Export sales report as PDF with comprehensive data matching frontend display
     */
    async exportSalesReportPDF(req, res) {
        try {
            const { 
                reportPeriod = 'last7days', 
                startDate, 
                endDate, 
                view = 'weekly',
                page = 1,
                limit = 10,
                ordersPage = 1,
                ordersLimit = 10
            } = req.query;
            
            // Normalize inputs
            let normalizedPeriod = reportPeriod.toLowerCase().replace(/\s+/g, '');
            if (normalizedPeriod.includes('custom')) normalizedPeriod = 'custom';
            let validStartDate = startDate;
            let validEndDate = endDate;
            
            // Set default date range
            const today = new Date();
            today.setHours(23, 59, 59, 999);
            const defaultEndDate = today.toISOString().split('T')[0];
            const lastWeek = new Date(today);
            lastWeek.setDate(today.getDate() - 6);
            const defaultStartDate = lastWeek.toISOString().split('T')[0];
            
            // Handle custom date range validation
            if (normalizedPeriod === 'custom') {
                if (!startDate || !endDate) {
                    validStartDate = defaultStartDate;
                    validEndDate = defaultEndDate;
                } else if (new Date(endDate) < new Date(startDate)) {
                    [validStartDate, validEndDate] = [endDate, startDate]; // swap dates
                } else if (new Date(startDate) > today || new Date(endDate) > today) {
                    validStartDate = defaultStartDate;
                    validEndDate = defaultEndDate;
                }
            }
            
            const normalizedView = view.toLowerCase().replace(/\s+/g, '');
            
            // Build filters object
            const filters = {
                reportPeriod: normalizedPeriod,
                startDate: validStartDate,
                endDate: validEndDate,
                period: normalizedView
            };
            
            // Fetch report data
            const [
                summary,
                reportDetails,
                couponAnalysis,
                productSalesData,
                detailedOrders
            ] = await Promise.all([
                salesReportService.getSummaryMetrics(filters),
                salesReportService.getSalesReportDetails(filters, parseInt(page), parseInt(limit)),
                salesReportService.getCouponAnalysis(filters),
                salesReportService.getProductSalesData(filters).catch(error => {
                    logger.warn(`PDF export: Failed to fetch product sales data: ${error.message}`);
                    return { 
                        labels: ['No Data Available'], 
                        data: [0],
                        backgroundColors: ['#e5e7eb'],
                        borderColors: ['#9ca3af']
                    };
                }),
                salesReportService.getDetailedOrders(filters, parseInt(ordersPage), parseInt(ordersLimit))
            ]);
            
            // Create PDF document with proper margins and layout
            const doc = new pdf({
                size: 'A4',
                margin: 40,
                bufferPages: true,
                font: 'Helvetica'
            });
            
            // Generate filename with proper formatting
            const dateRange = filters.reportPeriod === 'custom' && filters.startDate && filters.endDate
                ? `${new Date(filters.startDate).toISOString().split('T')[0]}_to_${new Date(filters.endDate).toISOString().split('T')[0]}`
                : `${new Date().toISOString().split('T')[0]}`;
            const filename = `sales_report_${dateRange}.pdf`;
            
            // Set response headers
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
            doc.pipe(res);
            
            // --- PAGE 1: HEADER AND SUMMARY ---
            // Draw header
            doc.fontSize(24).font('Helvetica-Bold').text('Casen Dashboard', { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(16).font('Helvetica-Bold').text('SALES REPORT', { align: 'center' });
            doc.moveDown();
            
            // Format date range text
            let dateRangeText = '';
            const todayDate = new Date();
            todayDate.setHours(23, 59, 59, 999);
            
            if (filters.reportPeriod === 'custom' && filters.startDate && filters.endDate) {
                const start = new Date(filters.startDate);
                const end = new Date(filters.endDate);
                dateRangeText = `${start.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                })} to ${end.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                })}`;
            } else {
                const periodMap = {
                    'today': 'Today',
                    'last7days': 'Last 7 Days',
                    'last30days': 'Last 30 Days',
                    'thismonth': 'This Month',
                    'thisyear': 'This Year'
                };
                dateRangeText = periodMap[normalizedPeriod] || 'Last 7 Days';
            }
            
            const viewText = normalizedView.charAt(0).toUpperCase() + normalizedView.slice(1);
            
            doc.fontSize(10).font('Helvetica').text(
                `Report Period: ${dateRangeText} | View: ${viewText} | Generated: ${todayDate.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                })}`,
                { align: 'center', lineHeight: 1.4 }
            );
            doc.moveDown(1.5);
            
            // Draw horizontal line
            doc.moveTo(40, doc.y)
               .lineTo(555, doc.y)
               .stroke();
            doc.moveDown(1);
            
            // --- SUMMARY METRICS SECTION ---
            doc.fontSize(14).font('Helvetica-Bold').text('EXECUTIVE SUMMARY', { underline: true });
            doc.moveDown(0.5);
            
            // Create summary metrics table
            const summaryHeaders = ['Metric', 'Value', 'Change vs Previous Period'];
            const summaryColWidths = [150, 150, 150];
            
            const summaryData = [
                [
                    'Total Sales',
                    `RS.${summary.totalSales.toFixed(2)}`,
                    `${summary.changes.totalSales > 0 ? '+' : ''}${summary.changes.totalSales.toFixed(1)}%`
                ],
                [
                    'Total Orders',
                    summary.totalOrders.toLocaleString(),
                    `${summary.changes.totalOrders > 0 ? '+' : ''}${summary.changes.totalOrders.toFixed(1)}%`
                ],
                [
                    'Total Discount',
                    `RS.${summary.totalDiscount.toFixed(2)}`,
                    `${summary.changes.totalDiscount < 0 ? '+' : ''}${Math.abs(summary.changes.totalDiscount).toFixed(1)}%`
                ]
            ];
            
            let y = doc.y;
            y = this.drawTable(
                doc,
                summaryHeaders,
                summaryData,
                summaryColWidths,
                y,
                { 
                    headerStyle: { 
                        font: 'Helvetica-Bold',
                        fontSize: 10,
                        fillColor: '#3b82f6',
                        textColor: '#ffffff'
                    },
                    rowStyle: { font: 'Helvetica', fontSize: 10 },
                    rowHeight: 25,
                    alternateRowColor: '#f8fafc'
                }
            );
            
            doc.moveDown(2);
            
            // --- REPORT DETAILS SECTION ---
            doc.fontSize(14).font('Helvetica-Bold').text('SALES REPORT DETAILS', { underline: true });
            doc.moveDown(0.5);
            
            // Report Details Table
            const reportHeaders = ['Date Period', 'Orders', 'Gross Sales', 'Discounts', 'Net Sales', 'Avg. Order Value'];
            const reportColWidths = [120, 60, 80, 80, 80, 80];
            
            const reportData = reportDetails.reportData.map(item => [
                item.datePeriod,
                item.orders.toString(),
                `RS.${parseFloat(item.grossSales).toFixed(2)}`,
                `RS.${parseFloat(item.discounts).toFixed(2)}`,
                `RS.${parseFloat(item.netSales).toFixed(2)}`,
                `RS.${parseFloat(item.avgOrderValue).toFixed(2)}`
            ]);
            
            // Add totals row
            if (reportData.length > 0) {
                reportData.push([
                    `TOTAL (${reportData.length} ${reportDetails.period})`,
                    reportDetails.reportData.reduce((sum, item) => sum + (item.orders || 0), 0).toString(),
                    `RS.${reportDetails.reportData.reduce((sum, item) => sum + parseFloat(item.grossSales || 0), 0).toFixed(2)}`,
                    `RS.${reportDetails.reportData.reduce((sum, item) => sum + parseFloat(item.discounts || 0), 0).toFixed(2)}`,
                    `RS.${reportDetails.reportData.reduce((sum, item) => sum + parseFloat(item.netSales || 0), 0).toFixed(2)}`,
                    `RS.${(() => {
                        const totalNetSales = reportDetails.reportData.reduce((sum, item) => sum + parseFloat(item.netSales || 0), 0);
                        const totalOrders = reportDetails.reportData.reduce((sum, item) => sum + (item.orders || 0), 0);
                        return totalOrders > 0 ? (totalNetSales / totalOrders).toFixed(2) : '0.00';
                    })()}`
                ]);
            }
            
            y = doc.y;
            y = this.drawTable(
                doc,
                reportHeaders,
                reportData,
                reportColWidths,
                y,
                { 
                    headerStyle: { 
                        font: 'Helvetica-Bold', 
                        fontSize: 9,
                        fillColor: '#1e40af',
                        textColor: '#ffffff'
                    },
                    rowStyle: { font: 'Helvetica', fontSize: 9 },
                    rowHeight: 22,
                    alternateRowColor: '#f0f9ff',
                    totalsRow: reportData.length - 1
                }
            );
            
            doc.moveDown(2);
            
            // --- PAGE BREAK FOR NEXT SECTION ---
            doc.addPage();
            
            // --- TOP SELLING PRODUCTS SECTION ---
            doc.fontSize(14).font('Helvetica-Bold').text('TOP SELLING PRODUCTS', { underline: true });
            doc.moveDown(0.5);
            
            // Product Sales Table
            const productHeaders = ['Product', 'Units Sold', '% of Total'];
            const productColWidths = [250, 100, 100];
            
            let productData = [];
            if (productSalesData.labels && productSalesData.labels.length > 0 && productSalesData.labels[0] !== 'No Data Available') {
                const totalUnits = productSalesData.data.reduce((sum, qty) => sum + qty, 0);
                productData = productSalesData.labels.map((label, index) => {
                    const quantity = productSalesData.data[index] || 0;
                    const percentage = totalUnits > 0 ? ((quantity / totalUnits) * 100).toFixed(1) : '0.0';
                    return [
                        label.length > 40 ? label.substring(0, 37) + '...' : label,
                        quantity.toString(),
                        `${percentage}%`
                    ];
                });
            } else {
                productData = [['No product data available', '', '']];
            }
            
            y = doc.y;
            y = this.drawTable(
                doc,
                productHeaders,
                productData,
                productColWidths,
                y,
                { 
                    headerStyle: { 
                        font: 'Helvetica-Bold', 
                        fontSize: 10,
                        fillColor: '#10b981',
                        textColor: '#ffffff'
                    },
                    rowStyle: { font: 'Helvetica', fontSize: 9 },
                    rowHeight: 20,
                    alternateRowColor: '#f0fdf4'
                }
            );
            
            doc.moveDown(2);
            
            // --- DETAILED ORDERS SECTION ---
            doc.fontSize(14).font('Helvetica-Bold').text('DETAILED ORDERS', { underline: true });
            doc.moveDown(0.5);
            
            doc.fontSize(9).font('Helvetica').text(
                `Showing orders ${((parseInt(ordersPage) - 1) * parseInt(ordersLimit) + 1)} to ${Math.min(parseInt(ordersPage) * parseInt(ordersLimit), detailedOrders.pagination.totalItems)} of ${detailedOrders.pagination.totalItems} total orders`,
                { lineHeight: 1.4 }
            );
            doc.moveDown(0.5);
            
            if (detailedOrders.orders.length > 0) {
                const orderHeaders = ['Order ID', 'Date', 'Customer', 'Email', 'Items', 'Amount', 'Status'];
                const orderColWidths = [90, 70, 100, 120, 40, 60, 70];
                
                const orderData = detailedOrders.orders.map(order => [
                    order.orderNumber,
                    order.date,
                    order.customer.length > 15 ? order.customer.substring(0, 12) + '...' : order.customer,
                    order.email.length > 20 ? order.email.substring(0, 17) + '...' : order.email,
                    order.items.toString(),
                    `RS.${parseFloat(order.totalAmount).toFixed(2)}`,
                    order.status.toUpperCase()
                ]);
                
                y = doc.y;
                y = this.drawTable(
                    doc,
                    orderHeaders,
                    orderData,
                    orderColWidths,
                    y,
                    { 
                        headerStyle: { 
                            font: 'Helvetica-Bold', 
                            fontSize: 9,
                            fillColor: '#0ea5e9',
                            textColor: '#ffffff'
                        },
                        rowStyle: { font: 'Helvetica', fontSize: 8 },
                        rowHeight: 18,
                        alternateRowColor: '#f0f9ff',
                        statusColumn: 6
                    }
                );
                
                doc.moveDown(1);
                
                // Pagination info
                doc.fontSize(9).font('Helvetica-Oblique').text(
                    `Page ${ordersPage} of ${detailedOrders.pagination.totalPages} | ${detailedOrders.pagination.totalItems} total orders`,
                    { align: 'center', width: 500 }
                );
            } else {
                doc.fontSize(11).font('Helvetica-Oblique').fillColor('#6b7280').text(
                    'No orders available for the selected period.', 
                    { align: 'center', width: 500 }
                );
                doc.fillColor('#000000');
            }
            
            // --- PAGE BREAK FOR COUPON ANALYSIS ---
            doc.addPage();
            
            // --- COUPON ANALYSIS SECTION ---
            doc.fontSize(14).font('Helvetica-Bold').text('COUPON & DISCOUNT ANALYSIS', { underline: true });
            doc.moveDown(0.5);
            
            if (couponAnalysis.length > 0) {
                const couponHeaders = ['Coupon', 'Description', 'Usage', 'Total Discount', 'Avg. Per Use', 'Status'];
                const couponColWidths = [80, 150, 60, 80, 80, 80];
                
                const couponData = couponAnalysis.map(coupon => [
                    coupon.code,
                    coupon.description.length > 30 ? coupon.description.substring(0, 27) + '...' : coupon.description,
                    coupon.usageCount.toString(),
                    `RS.${parseFloat(coupon.totalDiscount).toFixed(2)}`,
                    `RS.${parseFloat(coupon.avgDiscountPerUse).toFixed(2)}`,
                    coupon.status.toUpperCase()
                ]);
                
                // Add totals row
                const totalUsage = couponAnalysis.reduce((sum, coupon) => sum + coupon.usageCount, 0);
                const totalDiscount = couponAnalysis.reduce((sum, coupon) => sum + parseFloat(coupon.totalDiscount), 0);
                const avgPerUse = totalUsage > 0 ? totalDiscount / totalUsage : 0;
                
                couponData.push([
                    'TOTAL',
                    '',
                    totalUsage.toString(),
                    `RS.${totalDiscount.toFixed(2)}`,
                    `RS.${avgPerUse.toFixed(2)}`,
                    ''
                ]);
                
                y = doc.y;
                y = this.drawTable(
                    doc,
                    couponHeaders,
                    couponData,
                    couponColWidths,
                    y,
                    { 
                        headerStyle: { 
                            font: 'Helvetica-Bold', 
                            fontSize: 10,
                            fillColor: '#8b5cf6',
                            textColor: '#ffffff'
                        },
                        rowStyle: { font: 'Helvetica', fontSize: 9 },
                        rowHeight: 20,
                        alternateRowColor: '#f5f3ff',
                        totalsRow: couponData.length - 1
                    }
                );
            } else {
                doc.fontSize(11).font('Helvetica-Oblique').fillColor('#6b7280').text(
                    'No coupon data available for the selected period.', 
                    { align: 'center', width: 500 }
                );
                doc.fillColor('#000000');
            }
            
            doc.moveDown(2);
            
            // --- REPORT FOOTER ---
            // Add final page with summary statistics
            doc.addPage();
            
            doc.fontSize(16).font('Helvetica-Bold').text('REPORT SUMMARY STATISTICS', { align: 'center', underline: true });
            doc.moveDown(2);
            
            const statsY = doc.y;
            const stats = [
                { label: 'Report Period', value: dateRangeText },
                { label: 'Data View', value: viewText },
                { label: 'Total Sales', value: `RS.${summary.totalSales.toFixed(2)}` },
                { label: 'Total Orders', value: summary.totalOrders.toLocaleString() },
                { label: 'Total Discount', value: `RS.${summary.totalDiscount.toFixed(2)}` },
                { label: 'Average Order Value', value: `RS.${(() => {
                    const totalNetSales = reportDetails.reportData.reduce((sum, item) => sum + parseFloat(item.netSales || 0), 0);
                    const totalOrders = reportDetails.reportData.reduce((sum, item) => sum + (item.orders || 0), 0);
                    return totalOrders > 0 ? (totalNetSales / totalOrders).toFixed(2) : '0.00';
                })()}` },
                { label: 'Report Generated', value: new Date().toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                }) }
            ];
            
            stats.forEach((stat, index) => {
                const x = 40 + (index % 2) * 250;
                const y = statsY + Math.floor(index / 2) * 40;
                
                doc.fontSize(10).font('Helvetica-Bold').fillColor('#4b5563').text(stat.label, x, y);
                doc.fontSize(12).font('Helvetica').fillColor('#1e293b').text(stat.value, x, y + 15);
            });
            
            doc.moveDown(6);
            
            // Final footer with page numbers
            const totalPages = doc.bufferedPageRange().count;
            for (let i = 0; i < totalPages; i++) {
                doc.switchToPage(i);
                doc.fontSize(8).text(`Page ${i + 1} of ${totalPages}`, 40, doc.page.height - 30, { align: 'right' });
                doc.fontSize(8).fillColor('#6b7280').text('Casen Dashboard Analytics System', 40, doc.page.height - 20);
                doc.fillColor('#000000');
            }
            
            // Finalize PDF
            doc.end();
            logger.info(`Sales report PDF exported successfully for period: ${normalizedPeriod}`);
            
        } catch (error) {
            logger.error(`Error exporting sales report to PDF: ${error.message}`, error);
            if (!res.headersSent) {
                return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({
                    success: false,
                    message: 'Error exporting report to PDF: ' + error.message
                });
            }
        }
    },

    /**
     * Helper function to draw tables with advanced styling
     */
    drawTable(doc, headers, data, colWidths, startY, options = {}) {
        const {
            headerStyle = { font: 'Helvetica-Bold', fontSize: 10, fillColor: '#3b82f6', textColor: '#ffffff' },
            rowStyle = { font: 'Helvetica', fontSize: 10 },
            rowHeight = 25,
            alternateRowColor = '#f8fafc',
            totalsRow = -1,
            statusColumn = -1
        } = options;
        
        const totalWidth = colWidths.reduce((sum, w) => sum + w, 0);
        const startX = 40;
        let y = startY;
        
        // Draw header row
        doc.font(headerStyle.font).fontSize(headerStyle.fontSize);
        
        headers.forEach((header, i) => {
            const x = startX + colWidths.slice(0, i).reduce((sum, w) => sum + w, 0);
            
            // Header cell background
            doc.fillColor(headerStyle.fillColor || '#3b82f6');
            doc.rect(x, y, colWidths[i], rowHeight).fill();
            
            // Header text
            doc.fillColor(headerStyle.textColor || '#ffffff');
            doc.text(header, x + 5, y + (rowHeight - rowStyle.fontSize) / 2, {
                width: colWidths[i] - 10,
                align: 'left'
            });
        });
        
        y += rowHeight;
        
        // Draw data rows
        doc.font(rowStyle.font).fontSize(rowStyle.fontSize);
        
        data.forEach((row, rowIndex) => {
            const isAlternate = rowIndex % 2 === 1 && rowIndex !== totalsRow;
            const isTotals = rowIndex === totalsRow;
            
            // Row background
            if (isAlternate) {
                doc.fillColor(alternateRowColor);
                doc.rect(startX, y, totalWidth, rowHeight).fill();
            } else if (isTotals) {
                doc.fillColor('#bfdbfe');
                doc.rect(startX, y, totalWidth, rowHeight).fill();
                doc.font('Helvetica-Bold');
            }
            
            row.forEach((cell, colIndex) => {
                const x = startX + colWidths.slice(0, colIndex).reduce((sum, w) => sum + w, 0);
                const cellText = cell || '';
                
                // Handle status column coloring
                if (colIndex === statusColumn && !isTotals) {
                    let statusColor = '#94a3b8'; // default gray
                    let statusText = cellText.toLowerCase();
                    
                    if (statusText.includes('delivered') || statusText.includes('active')) {
                        statusColor = '#22c55e'; // green
                    } else if (statusText.includes('shipped')) {
                        statusColor = '#3b82f6'; // blue
                    } else if (statusText.includes('cancelled') || statusText.includes('inactive')) {
                        statusColor = '#ef4444'; // red
                    }
                    
                    // Draw status badge background
                    doc.fillColor(statusColor + '20'); // 20% opacity
                    doc.roundedRect(x + 5, y + 3, colWidths[colIndex] - 10, rowHeight - 6, 3).fill();
                    
                    // Status text
                    doc.fillColor(statusColor);
                    doc.text(cellText, x + 5, y + (rowHeight - rowStyle.fontSize) / 2, {
                        width: colWidths[colIndex] - 10,
                        align: 'center'
                    });
                } else {
                    // Regular cell
                    doc.fillColor(isTotals ? '#1e293b' : '#4b5563');
                    doc.text(cellText.toString(), x + 5, y + (rowHeight - rowStyle.fontSize) / 2, {
                        width: colWidths[colIndex] - 10,
                        align: 'left'
                    });
                }
            });
            
            // Row border
            doc.strokeColor('#e2e8f0');
            doc.lineWidth(0.5);
            doc.rect(startX, y, totalWidth, rowHeight).stroke();
            
            y += rowHeight;
        });
        
        // Table border
        doc.strokeColor('#cbd5e1');
        doc.lineWidth(1);
        doc.rect(startX, startY, totalWidth, y - startY).stroke();
        
        doc.y = y;
        doc.fillColor('#000000');
        doc.strokeColor('#000000');
        doc.lineWidth(1);
        doc.font('Helvetica');
        
        return y;
    },

    /**
     * Export sales report as Excel
     */
    /**
 * Export sales report as Excel with comprehensive data matching PDF structure
 */
async exportSalesReportExcel(req, res) {
    try {
        const { 
            reportPeriod = 'last7days', 
            startDate, 
            endDate, 
            view = 'weekly',
            page = 1,
            limit = 10,
            ordersPage = 1,
            ordersLimit = 10
        } = req.query;
        
        // Normalize inputs
        let normalizedPeriod = reportPeriod.toLowerCase().replace(/\s+/g, '');
        if (normalizedPeriod.includes('custom')) normalizedPeriod = 'custom';
        let validStartDate = startDate;
        let validEndDate = endDate;
        
        // Set default date range
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const defaultEndDate = today.toISOString().split('T')[0];
        const lastWeek = new Date(today);
        lastWeek.setDate(today.getDate() - 6);
        const defaultStartDate = lastWeek.toISOString().split('T')[0];
        
        // Handle custom date range validation
        if (normalizedPeriod === 'custom') {
            if (!startDate || !endDate) {
                validStartDate = defaultStartDate;
                validEndDate = defaultEndDate;
            } else if (new Date(endDate) < new Date(startDate)) {
                [validStartDate, validEndDate] = [endDate, startDate];
            } else if (new Date(startDate) > today || new Date(endDate) > today) {
                validStartDate = defaultStartDate;
                validEndDate = defaultEndDate;
            }
        }
        
        const normalizedView = view.toLowerCase().replace(/\s+/g, '');
        
        // Build filters object
        const filters = {
            reportPeriod: normalizedPeriod,
            startDate: validStartDate,
            endDate: validEndDate,
            period: normalizedView
        };
        
        // Fetch report data
        const [
            summary,
            reportDetails,
            couponAnalysis,
            productSalesData,
            detailedOrders
        ] = await Promise.all([
            salesReportService.getSummaryMetrics(filters),
            salesReportService.getSalesReportDetails(filters, parseInt(page), parseInt(limit)),
            salesReportService.getCouponAnalysis(filters),
            salesReportService.getProductSalesData(filters).catch(error => {
                logger.warn(`Excel export: Failed to fetch product sales data: ${error.message}`);
                return { 
                    labels: ['No Data Available'], 
                    data: [0]
                };
            }),
            salesReportService.getDetailedOrders(filters, parseInt(ordersPage), parseInt(ordersLimit))
        ]);
        
        // Import ExcelJS
        const workbook = new ExcelJS.Workbook();
        
        // Format date range text
        let dateRangeText = '';
        const todayDate = new Date();
        todayDate.setHours(23, 59, 59, 999);
        
        if (filters.reportPeriod === 'custom' && filters.startDate && filters.endDate) {
            const start = new Date(filters.startDate);
            const end = new Date(filters.endDate);
            dateRangeText = `${start.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
            })} to ${end.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
            })}`;
        } else {
            const periodMap = {
                'today': 'Today',
                'last7days': 'Last 7 Days',
                'last30days': 'Last 30 Days',
                'thismonth': 'This Month',
                'thisyear': 'This Year'
            };
            dateRangeText = periodMap[normalizedPeriod] || 'Last 7 Days';
        }
        
        const viewText = normalizedView.charAt(0).toUpperCase() + normalizedView.slice(1);
        
        // Define common styles
        const titleStyle = {
            font: { bold: true, size: 16, color: { argb: 'FF1F2937' } },
            alignment: { horizontal: 'center', vertical: 'middle' }
        };
        
        const headerStyle = {
            font: { bold: true, size: 11, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } },
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: {
                top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
            }
        };
        
        const cellBorder = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
        
        // ==================== SUMMARY SHEET ====================
        const summarySheet = workbook.addWorksheet('Executive Summary');
        
        // Title
        summarySheet.mergeCells('A1:F1');
        summarySheet.getCell('A1').value = 'Casen Dashboard';
        summarySheet.getCell('A1').style = titleStyle;
        summarySheet.getRow(1).height = 25;
        
        // Subtitle
        summarySheet.mergeCells('A2:F2');
        summarySheet.getCell('A2').value = 'SALES REPORT';
        summarySheet.getCell('A2').style = {
            font: { bold: true, size: 14, color: { argb: 'FF1F2937' } },
            alignment: { horizontal: 'center', vertical: 'middle' }
        };
        summarySheet.getRow(2).height = 20;
        
        // Report info
        summarySheet.mergeCells('A3:F3');
        summarySheet.getCell('A3').value = `Report Period: ${dateRangeText} | View: ${viewText} | Generated: ${todayDate.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })}`;
        summarySheet.getCell('A3').style = {
            font: { size: 10, color: { argb: 'FF6B7280' } },
            alignment: { horizontal: 'center', vertical: 'middle' }
        };
        
        summarySheet.addRow([]);
        
        // Executive Summary Section
        summarySheet.addRow(['EXECUTIVE SUMMARY']).font = { bold: true, size: 12 };
        summarySheet.addRow([]);
        
        // Summary headers
        const summaryHeaderRow = summarySheet.addRow(['Metric', 'Value', 'Change vs Previous Period']);
        summaryHeaderRow.eachCell(cell => {
            cell.style = headerStyle;
        });
        summarySheet.getRow(summaryHeaderRow.number).height = 20;
        
        // Summary data
        const summaryData = [
            ['Total Sales', summary.totalSales, `${summary.changes.totalSales > 0 ? '+' : ''}${summary.changes.totalSales.toFixed(1)}%`],
            ['Total Orders', summary.totalOrders, `${summary.changes.totalOrders > 0 ? '+' : ''}${summary.changes.totalOrders.toFixed(1)}%`],
            ['Total Discount', summary.totalDiscount, `${summary.changes.totalDiscount < 0 ? '+' : ''}${Math.abs(summary.changes.totalDiscount).toFixed(1)}%`]
        ];
        
        summaryData.forEach(([metric, value, change]) => {
            const row = summarySheet.addRow([metric, value, change]);
            row.getCell(1).border = cellBorder;
            row.getCell(2).border = cellBorder;
            row.getCell(3).border = cellBorder;
            row.getCell(2).numFmt = typeof value === 'number' && metric.includes('Sales') || metric.includes('Discount') 
                ? '"RS."#,##0.00' 
                : '#,##0';
        });
        
        // Column widths
        summarySheet.getColumn(1).width = 25;
        summarySheet.getColumn(2).width = 20;
        summarySheet.getColumn(3).width = 30;
        
        // ==================== SALES REPORT DETAILS SHEET ====================
        const detailsSheet = workbook.addWorksheet('Sales Report Details');
        
        // Title
        detailsSheet.mergeCells('A1:F1');
        detailsSheet.getCell('A1').value = 'SALES REPORT DETAILS';
        detailsSheet.getCell('A1').style = titleStyle;
        detailsSheet.getRow(1).height = 25;
        
        detailsSheet.addRow([]);
        
        // Headers
        const detailsHeaderRow = detailsSheet.addRow(['Date Period', 'Orders', 'Gross Sales', 'Discounts', 'Net Sales', 'Avg. Order Value']);
        detailsHeaderRow.eachCell(cell => {
            cell.style = {
                ...headerStyle,
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } }
            };
        });
        detailsSheet.getRow(detailsHeaderRow.number).height = 20;
        
        // Data rows with alternating colors
        reportDetails.reportData.forEach((item, index) => {
            const row = detailsSheet.addRow([
                item.datePeriod,
                item.orders,
                parseFloat(item.grossSales),
                parseFloat(item.discounts),
                parseFloat(item.netSales),
                parseFloat(item.avgOrderValue)
            ]);
            
            row.eachCell((cell, colNumber) => {
                cell.border = cellBorder;
                if (index % 2 === 1) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
                }
            });
        });
        
        // Totals row
        const totalOrders = reportDetails.reportData.reduce((sum, item) => sum + (item.orders || 0), 0);
        const totalGrossSales = reportDetails.reportData.reduce((sum, item) => sum + parseFloat(item.grossSales || 0), 0);
        const totalDiscounts = reportDetails.reportData.reduce((sum, item) => sum + parseFloat(item.discounts || 0), 0);
        const totalNetSales = reportDetails.reportData.reduce((sum, item) => sum + parseFloat(item.netSales || 0), 0);
        const avgOrderValue = totalOrders > 0 ? (totalNetSales / totalOrders) : 0;
        
        const totalsRow = detailsSheet.addRow([
            `TOTAL (${reportDetails.reportData.length} ${reportDetails.period})`,
            totalOrders,
            totalGrossSales,
            totalDiscounts,
            totalNetSales,
            avgOrderValue
        ]);
        
        totalsRow.eachCell(cell => {
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBFDBFE' } };
            cell.border = cellBorder;
        });
        
        // Format currency columns
        detailsSheet.getColumn(3).numFmt = '"RS."#,##0.00';
        detailsSheet.getColumn(4).numFmt = '"RS."#,##0.00';
        detailsSheet.getColumn(5).numFmt = '"RS."#,##0.00';
        detailsSheet.getColumn(6).numFmt = '"RS."#,##0.00';
        
        // Column widths
        detailsSheet.getColumn(1).width = 25;
        detailsSheet.getColumn(2).width = 12;
        detailsSheet.getColumn(3).width = 18;
        detailsSheet.getColumn(4).width = 18;
        detailsSheet.getColumn(5).width = 18;
        detailsSheet.getColumn(6).width = 20;
        
        // ==================== TOP SELLING PRODUCTS SHEET ====================
        const productsSheet = workbook.addWorksheet('Top Selling Products');
        
        // Title
        productsSheet.mergeCells('A1:C1');
        productsSheet.getCell('A1').value = 'TOP SELLING PRODUCTS';
        productsSheet.getCell('A1').style = titleStyle;
        productsSheet.getRow(1).height = 25;
        
        productsSheet.addRow([]);
        
        // Headers
        const productsHeaderRow = productsSheet.addRow(['Product', 'Units Sold', '% of Total']);
        productsHeaderRow.eachCell(cell => {
            cell.style = {
                ...headerStyle,
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } }
            };
        });
        productsSheet.getRow(productsHeaderRow.number).height = 20;
        
        // Data rows
        if (productSalesData.labels && productSalesData.labels.length > 0 && productSalesData.labels[0] !== 'No Data Available') {
            const totalUnits = productSalesData.data.reduce((sum, qty) => sum + qty, 0);
            
            productSalesData.labels.forEach((label, index) => {
                const quantity = productSalesData.data[index] || 0;
                const percentage = totalUnits > 0 ? ((quantity / totalUnits) * 100) : 0;
                
                const row = productsSheet.addRow([label, quantity, percentage / 100]);
                
                row.eachCell((cell, colNumber) => {
                    cell.border = cellBorder;
                    if (index % 2 === 1) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
                    }
                });
                
                row.getCell(3).numFmt = '0.0%';
            });
        } else {
            productsSheet.addRow(['No product data available', '', '']);
        }
        
        // Column widths
        productsSheet.getColumn(1).width = 40;
        productsSheet.getColumn(2).width = 15;
        productsSheet.getColumn(3).width = 15;
        
        // ==================== DETAILED ORDERS SHEET ====================
        const ordersSheet = workbook.addWorksheet('Detailed Orders');
        
        // Title
        ordersSheet.mergeCells('A1:G1');
        ordersSheet.getCell('A1').value = 'DETAILED ORDERS';
        ordersSheet.getCell('A1').style = titleStyle;
        ordersSheet.getRow(1).height = 25;
        
        // Info row
        ordersSheet.mergeCells('A2:G2');
        ordersSheet.getCell('A2').value = `Showing orders ${((parseInt(ordersPage) - 1) * parseInt(ordersLimit) + 1)} to ${Math.min(parseInt(ordersPage) * parseInt(ordersLimit), detailedOrders.pagination.totalItems)} of ${detailedOrders.pagination.totalItems} total orders`;
        ordersSheet.getCell('A2').style = {
            font: { size: 10, color: { argb: 'FF6B7280' } },
            alignment: { horizontal: 'center' }
        };
        
        ordersSheet.addRow([]);
        
        // Headers
        const ordersHeaderRow = ordersSheet.addRow(['Order ID', 'Date', 'Customer', 'Email', 'Items', 'Amount', 'Status']);
        ordersHeaderRow.eachCell(cell => {
            cell.style = {
                ...headerStyle,
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0EA5E9' } }
            };
        });
        ordersSheet.getRow(ordersHeaderRow.number).height = 20;
        
        // Data rows
        if (detailedOrders.orders.length > 0) {
            detailedOrders.orders.forEach((order, index) => {
                const row = ordersSheet.addRow([
                    order.orderNumber,
                    order.date,
                    order.customer,
                    order.email,
                    order.items,
                    parseFloat(order.totalAmount),
                    order.status.toUpperCase()
                ]);
                
                row.eachCell((cell, colNumber) => {
                    cell.border = cellBorder;
                    if (index % 2 === 1) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
                    }
                    
                    // Status column coloring
                    if (colNumber === 7) {
                        const status = order.status.toLowerCase();
                        if (status.includes('delivered')) {
                            cell.font = { color: { argb: 'FF22C55E' }, bold: true };
                        } else if (status.includes('shipped')) {
                            cell.font = { color: { argb: 'FF3B82F6' }, bold: true };
                        } else if (status.includes('cancelled')) {
                            cell.font = { color: { argb: 'FFEF4444' }, bold: true };
                        }
                    }
                });
            });
            
            // Pagination info
            ordersSheet.addRow([]);
            ordersSheet.mergeCells(`A${ordersSheet.rowCount}:G${ordersSheet.rowCount}`);
            ordersSheet.getCell(`A${ordersSheet.rowCount}`).value = `Page ${ordersPage} of ${detailedOrders.pagination.totalPages} | ${detailedOrders.pagination.totalItems} total orders`;
            ordersSheet.getCell(`A${ordersSheet.rowCount}`).style = {
                font: { italic: true, size: 9, color: { argb: 'FF6B7280' } },
                alignment: { horizontal: 'center' }
            };
        } else {
            ordersSheet.addRow(['No orders available for the selected period', '', '', '', '', '', '']);
        }
        
        // Format currency column
        ordersSheet.getColumn(6).numFmt = '"RS."#,##0.00';
        
        // Column widths
        ordersSheet.getColumn(1).width = 15;
        ordersSheet.getColumn(2).width = 12;
        ordersSheet.getColumn(3).width = 20;
        ordersSheet.getColumn(4).width = 25;
        ordersSheet.getColumn(5).width = 10;
        ordersSheet.getColumn(6).width = 15;
        ordersSheet.getColumn(7).width = 15;
        
        // ==================== COUPON ANALYSIS SHEET ====================
        const couponsSheet = workbook.addWorksheet('Coupon Analysis');
        
        // Title
        couponsSheet.mergeCells('A1:F1');
        couponsSheet.getCell('A1').value = 'COUPON & DISCOUNT ANALYSIS';
        couponsSheet.getCell('A1').style = titleStyle;
        couponsSheet.getRow(1).height = 25;
        
        couponsSheet.addRow([]);
        
        if (couponAnalysis.length > 0) {
            // Headers
            const couponsHeaderRow = couponsSheet.addRow(['Coupon', 'Description', 'Usage', 'Total Discount', 'Avg. Per Use', 'Status']);
            couponsHeaderRow.eachCell(cell => {
                cell.style = {
                    ...headerStyle,
                    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } }
                };
            });
            couponsSheet.getRow(couponsHeaderRow.number).height = 20;
            
            // Data rows
            couponAnalysis.forEach((coupon, index) => {
                const row = couponsSheet.addRow([
                    coupon.code,
                    coupon.description,
                    coupon.usageCount,
                    parseFloat(coupon.totalDiscount),
                    parseFloat(coupon.avgDiscountPerUse),
                    coupon.status.toUpperCase()
                ]);
                
                row.eachCell((cell, colNumber) => {
                    cell.border = cellBorder;
                    if (index % 2 === 1) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
                    }
                    
                    // Status column coloring
                    if (colNumber === 6) {
                        const status = coupon.status.toLowerCase();
                        if (status.includes('active')) {
                            cell.font = { color: { argb: 'FF22C55E' }, bold: true };
                        } else if (status.includes('inactive')) {
                            cell.font = { color: { argb: 'FFEF4444' }, bold: true };
                        }
                    }
                });
            });
            
            // Totals row
            const totalUsage = couponAnalysis.reduce((sum, coupon) => sum + coupon.usageCount, 0);
            const totalDiscount = couponAnalysis.reduce((sum, coupon) => sum + parseFloat(coupon.totalDiscount), 0);
            const avgPerUse = totalUsage > 0 ? totalDiscount / totalUsage : 0;
            
            const couponsTotalsRow = couponsSheet.addRow([
                'TOTAL',
                '',
                totalUsage,
                totalDiscount,
                avgPerUse,
                ''
            ]);
            
            couponsTotalsRow.eachCell(cell => {
                cell.font = { bold: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBFDBFE' } };
                cell.border = cellBorder;
            });
            
            // Format currency columns
            couponsSheet.getColumn(4).numFmt = '"RS."#,##0.00';
            couponsSheet.getColumn(5).numFmt = '"RS."#,##0.00';
        } else {
            couponsSheet.addRow(['No coupon data available for the selected period', '', '', '', '', '']);
        }
        
        // Column widths
        couponsSheet.getColumn(1).width = 15;
        couponsSheet.getColumn(2).width = 35;
        couponsSheet.getColumn(3).width = 12;
        couponsSheet.getColumn(4).width = 18;
        couponsSheet.getColumn(5).width = 18;
        couponsSheet.getColumn(6).width = 15;
        
        // ==================== REPORT SUMMARY SHEET ====================
        const reportSummarySheet = workbook.addWorksheet('Report Summary');
        
        // Title
        reportSummarySheet.mergeCells('A1:D1');
        reportSummarySheet.getCell('A1').value = 'REPORT SUMMARY STATISTICS';
        reportSummarySheet.getCell('A1').style = titleStyle;
        reportSummarySheet.getRow(1).height = 25;
        
        reportSummarySheet.addRow([]);
        reportSummarySheet.addRow([]);
        
        // Summary statistics
        const stats = [
            { label: 'Report Period', value: dateRangeText },
            { label: 'Data View', value: viewText },
            { label: 'Total Sales', value: `RS.${summary.totalSales.toFixed(2)}` },
            { label: 'Total Orders', value: summary.totalOrders.toLocaleString() },
            { label: 'Total Discount', value: `RS.${summary.totalDiscount.toFixed(2)}` },
            { label: 'Average Order Value', value: `RS.${avgOrderValue.toFixed(2)}` },
            { label: 'Report Generated', value: todayDate.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) }
        ];
        
        let currentRow = 4;
        stats.forEach((stat, index) => {
            const col = index % 2 === 0 ? 1 : 3;
            const row = currentRow + Math.floor(index / 2) * 3;
            
            reportSummarySheet.getCell(row, col).value = stat.label;
            reportSummarySheet.getCell(row, col).font = { bold: true, size: 10, color: { argb: 'FF4B5563' } };
            
            reportSummarySheet.getCell(row + 1, col).value = stat.value;
            reportSummarySheet.getCell(row + 1, col).font = { size: 12, color: { argb: 'FF1E293B' } };
        });
        
        reportSummarySheet.getColumn(1).width = 25;
        reportSummarySheet.getColumn(2).width = 5;
        reportSummarySheet.getColumn(3).width = 25;
        reportSummarySheet.getColumn(4).width = 5;
        
        // Generate filename
        const dateRange = filters.reportPeriod === 'custom' && filters.startDate && filters.endDate
            ? `${filters.startDate}_to_${filters.endDate}`
            : new Date().toISOString().split('T')[0];
        const filename = `sales_report_${dateRange}.xlsx`;
        
        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        // Write to response
        await workbook.xlsx.write(res);
        res.end();
        
        logger.info(`Sales report Excel exported successfully for period: ${normalizedPeriod}`);
        
    } catch (error) {
        logger.error(`Error exporting sales report to Excel: ${error.message}`, error);
        if (!res.headersSent) {
            return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: 'Error exporting report to Excel: ' + error.message
            });
        }
    }
}
};