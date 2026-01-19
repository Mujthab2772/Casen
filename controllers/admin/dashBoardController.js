import { dashboardDetails, salesReportService } from "../../service/admin/dashBoardService.js";
import pdf from 'pdfkit';
import { STATUS_CODE } from "../../util/statusCodes.js";
import logger from '../../util/logger.js'; // ✅ Adjust path as per your project structure

// No need for fs/path/fileURLToPath unless you're saving PDFs to disk (you're streaming directly)

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

export const salesReportController = {
  async getSalesReportPage(req, res) {
    try {
      const { 
        reportPeriod = 'last7days',
        startDate,
        endDate,
        view = 'weekly',
        page = 1, 
        limit = 5 
      } = req.query;

      let normalizedPeriod = reportPeriod.toLowerCase().replace(/\s+/g, '');
      if (normalizedPeriod.includes('custom')) normalizedPeriod = 'custom';

      let validStartDate = startDate;
      let validEndDate = endDate;

      const today = new Date();
      const defaultEndDate = today.toISOString().split('T')[0];
      const lastWeek = new Date(today);
      lastWeek.setDate(today.getDate() - 6);
      const defaultStartDate = lastWeek.toISOString().split('T')[0];

      if (normalizedPeriod === 'custom') {
        if (!startDate || !endDate) {
          validStartDate = defaultStartDate;
          validEndDate = defaultEndDate;
        } else if (new Date(endDate) < new Date(startDate)) {
          [validStartDate, validEndDate] = [endDate, startDate]; // swap
        } else if (new Date(startDate) > today || new Date(endDate) > today) {
          validStartDate = defaultStartDate;
          validEndDate = defaultEndDate;
        }
      }

      const normalizedView = view.toLowerCase().replace(/\s+/g, '');

      const filters = {
        reportPeriod: normalizedPeriod,
        startDate: validStartDate,
        endDate: validEndDate,
        period: normalizedView
      };

      const summary = await salesReportService.getSummaryMetrics(filters);
      const reportDetails = await salesReportService.getSalesReportDetails(filters, parseInt(page), parseInt(limit));
      const couponAnalysis = await salesReportService.getCouponAnalysis(filters);

      let safeProductSalesData;
      try {
        safeProductSalesData = await salesReportService.getProductSalesData(filters);
      } catch (error) {
        logger.warn(`Failed to fetch product sales data for report: ${error.message}`);
        safeProductSalesData = {
          labels: ['No Data'],
          data: [0],
          backgroundColors: ['#e5e7eb'],
          borderColors: ['#9ca3af']
        };
      }

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
            grossSales: typeof item.grossSales === 'number' ? parseFloat(item.grossSales).toFixed(2) : '0.00',
            discounts: typeof item.discounts === 'number' ? parseFloat(item.discounts).toFixed(2) : '0.00',
            netSales: typeof item.netSales === 'number' ? parseFloat(item.netSales).toFixed(2) : '0.00',
            avgOrderValue: typeof item.avgOrderValue === 'number' ? parseFloat(item.avgOrderValue).toFixed(2) : '0.00',
            couponsApplied: typeof item.couponsApplied === 'number' ? parseFloat(item.couponsApplied).toFixed(2) : '0.00'
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
          totalDiscount: typeof coupon.totalDiscount === 'number' ? parseFloat(coupon.totalDiscount).toFixed(2) : '0.00',
          avgDiscountPerUse: typeof coupon.avgDiscountPerUse === 'number' ? parseFloat(coupon.avgDiscountPerUse).toFixed(2) : '0.00'
        })),
        productSales: {
          labels: safeProductSalesData.labels || ['No Data'],
          data: safeProductSalesData.data || [0],
          backgroundColors: safeProductSalesData.backgroundColors || ['#e5e7eb'],
          borderColors: safeProductSalesData.borderColors || ['#9ca3af']
        },
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
        }
      };

      return res.render('analytics', { title: 'Sales Reports', data: formattedData });

    } catch (error) {
      logger.error(`Error in GET /admin/sales-report: ${error.message}`);
      return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).send('Error generating sales report');
    }
  },

  async exportSalesReportPDF(req, res) {
    try {
      const { reportPeriod = 'last7days', startDate, endDate, view = 'weekly' } = req.query;

      let normalizedPeriod = reportPeriod.toLowerCase().replace(/\s+/g, '');
      if (normalizedPeriod.includes('custom')) normalizedPeriod = 'custom';
      const normalizedView = view.toLowerCase().replace(/\s+/g, '');

      const filters = { reportPeriod: normalizedPeriod, startDate, endDate, period: normalizedView };

      const summary = await salesReportService.getSummaryMetrics(filters);
      const reportDetails = await salesReportService.getSalesReportDetails(filters);
      const couponAnalysis = await salesReportService.getCouponAnalysis(filters);

      let productSalesData;
      try {
        productSalesData = await salesReportService.getProductSalesData(filters);
      } catch (error) {
        logger.warn(`PDF export: Failed to fetch product sales data: ${error.message}`);
        productSalesData = { labels: ['No Data'], data: [0] };
      }

      const doc = new pdf({ size: 'A4', margin: 50, bufferPages: true });

      const dateRange = filters.reportPeriod === 'custom' && filters.startDate && filters.endDate
        ? `${filters.startDate}_to_${filters.endDate}`
        : new Date().toISOString().split('T')[0];
      const filename = `sales_report_${dateRange}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      doc.pipe(res);

      // --- PDF content rendering (unchanged logic, just logging added above) ---

      doc.fontSize(14).text('Casen Dashboard', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(22).text('Sales Report', { align: 'center', bold: true });
      doc.moveDown();

      let dateRangeText = '';
      if (filters.reportPeriod === 'custom' && filters.startDate && filters.endDate) {
        dateRangeText = `${new Date(filters.startDate).toLocaleDateString()} to ${new Date(filters.endDate).toLocaleDateString()}`;
      } else {
        dateRangeText = filters.reportPeriod === 'today' ? 'Today' :
                       filters.reportPeriod === 'last7days' ? 'Last 7 days' :
                       filters.reportPeriod === 'last30days' ? 'Last 30 days' :
                       filters.reportPeriod === 'thismonth' ? 'This month' : 'This year';
      }

      doc.fontSize(12).text(`Period: ${dateRangeText} | View: ${normalizedView.charAt(0).toUpperCase() + normalizedView.slice(1)}`, { align: 'center' });
      doc.moveDown(1.5);

      const drawTable = (doc, headers, data, colWidths, startY, options = {}) => {
        const { headerStyle = { font: 'Helvetica-Bold', fontSize: 10 }, rowStyle = { font: 'Helvetica', fontSize: 10 }, rowHeight = 25, padding = 5 } = options;
        let y = startY;
        const tableWidth = colWidths.reduce((sum, width) => sum + width, 0);

        doc.font(headerStyle.font).fontSize(headerStyle.fontSize);
        headers.forEach((header, i) => {
          const x = 50 + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
          doc.rect(x, y, colWidths[i], rowHeight).stroke();
          doc.text(header, x + padding, y + padding, { width: colWidths[i] - 2 * padding, align: 'left' });
        });
        y += rowHeight;

        doc.font(rowStyle.font).fontSize(rowStyle.fontSize);
        data.forEach(row => {
          row.forEach((cell, i) => {
            const x = 50 + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
            doc.rect(x, y, colWidths[i], rowHeight).stroke();
            doc.text(cell, x + padding, y + padding, { width: colWidths[i] - 2 * padding, align: 'left' });
          });
          y += rowHeight;
        });
        doc.rect(50, y - rowHeight, tableWidth, rowHeight).stroke();
        return y;
      };

      // Summary Table
      const summaryColWidths = [100, 150, 150];
      doc.fontSize(14).text('Summary', 50, doc.y, { width: summaryColWidths.reduce((a, b) => a + b, 0), align: 'center', underline: true });
      doc.moveDown(0.5);
      const summaryData = [
        ['Total Sales', `Rs. ${summary.totalSales.toFixed(2)}`, `${summary.changes.totalSales > 0 ? '+' : ''}${summary.changes.totalSales.toFixed(1)}%`],
        ['Total Orders', summary.totalOrders.toString(), `${summary.changes.totalOrders > 0 ? '+' : ''}${summary.changes.totalOrders.toFixed(1)}%`],
        ['Total Discount', `Rs. ${summary.totalDiscount.toFixed(2)}`, `${summary.changes.totalDiscount < 0 ? '+' : ''}${Math.abs(summary.changes.totalDiscount).toFixed(1)}%`]
      ];
      let y = doc.y;
      y = drawTable(doc, ['Metric', 'Value', 'Change'], summaryData, summaryColWidths, y, { rowHeight: 22, padding: 4 });
      doc.moveDown(1.5);

      // Report Details
      const reportColWidths = [120, 60, 80, 80, 80];
      doc.fontSize(14).text('Sales Report Details', 50, doc.y, { width: reportColWidths.reduce((a, b) => a + b, 0), align: 'center', underline: true });
      doc.moveDown(0.5);
      const reportData = reportDetails.reportData.map(item => [
        item.datePeriod,
        item.orders.toString(),
        `Rs. ${parseFloat(item.grossSales).toFixed(2)}`,
        `Rs. ${parseFloat(item.discounts).toFixed(2)}`,
        `Rs. ${parseFloat(item.netSales).toFixed(2)}`
      ]);
      reportData.push([
        `Total (${reportData.length} ${reportDetails.period})`,
        reportDetails.reportData.reduce((sum, item) => sum + (item.orders || 0), 0).toString(),
        `Rs. ${reportDetails.reportData.reduce((sum, item) => sum + parseFloat(item.grossSales || 0), 0).toFixed(2)}`,
        `Rs. ${reportDetails.reportData.reduce((sum, item) => sum + parseFloat(item.discounts || 0), 0).toFixed(2)}`,
        `Rs. ${reportDetails.reportData.reduce((sum, item) => sum + parseFloat(item.netSales || 0), 0).toFixed(2)}`
      ]);
      y = doc.y;
      y = drawTable(doc, ['Date Period', 'Orders', 'Gross Sales', 'Discounts', 'Net Sales'], reportData, reportColWidths, y, { rowHeight: 22, padding: 4 });
      doc.moveDown(1.5);

      // Product Sales
      const productColWidths = [200, 100];
      doc.fontSize(14).text('Top Selling Products', 50, doc.y, { width: productColWidths.reduce((a, b) => a + b, 0), align: 'center', underline: true });
      doc.moveDown(0.5);
      const productData = productSalesData.labels.map((label, index) => [label, productSalesData.data[index].toString()]);
      y = doc.y;
      y = drawTable(doc, ['Product', 'Units Sold'], productData, productColWidths, y, { rowHeight: 22, padding: 4 });
      doc.moveDown(1.5);

      // Coupon Analysis
      if (couponAnalysis.length > 0) {
        const couponColWidths = [120, 60, 100, 100];
        doc.fontSize(14).text('Coupon Analysis', 50, doc.y, { width: couponColWidths.reduce((a, b) => a + b, 0), align: 'center', underline: true });
        doc.moveDown(0.5);
        const couponData = couponAnalysis.map(coupon => [
          coupon.code,
          coupon.usageCount.toString(),
          `Rs. ${parseFloat(coupon.totalDiscount).toFixed(2)}`,
          `Rs. ${parseFloat(coupon.avgDiscountPerUse).toFixed(2)}`
        ]);
        const totalUsage = couponAnalysis.reduce((sum, coupon) => sum + coupon.usageCount, 0);
        const totalDiscount = couponAnalysis.reduce((sum, coupon) => sum + parseFloat(coupon.totalDiscount), 0);
        const avgPerUse = totalUsage > 0 ? totalDiscount / totalUsage : 0;
        couponData.push(['Total', totalUsage.toString(), `Rs. ${totalDiscount.toFixed(2)}`, `Rs. ${avgPerUse.toFixed(2)}`]);
        y = doc.y;
        y = drawTable(doc, ['Coupon', 'Usage', 'Total Discount', 'Avg. Per Use'], couponData, couponColWidths, y, { rowHeight: 22, padding: 4 });
      }

      doc.moveDown(2);
      doc.fontSize(8).text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });

      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).text(`Page ${i + 1} of ${totalPages}`, 50, doc.page.height - 45, { align: 'center' });
      }

      doc.end();
      logger.info(`Sales report PDF exported successfully for period: ${normalizedPeriod}`);

    } catch (error) {
      logger.error(`Error exporting sales report to PDF: ${error.message}`);
      return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Error exporting report to PDF' });
    }
  },

  async exportSalesReportExcel(req, res) {
    try {
      const { reportPeriod = 'last7days', startDate, endDate, view = 'weekly' } = req.query;

      let normalizedPeriod = reportPeriod.toLowerCase().replace(/\s+/g, '');
      if (normalizedPeriod.includes('custom')) normalizedPeriod = 'custom';
      const normalizedView = view.toLowerCase().replace(/\s+/g, '');

      const filters = { reportPeriod: normalizedPeriod, startDate, endDate, period: normalizedView };

      const summary = await salesReportService.getSummaryMetrics(filters);
      const reportDetails = await salesReportService.getSalesReportDetails(filters);
      const couponAnalysis = await salesReportService.getCouponAnalysis(filters);

      logger.info(`Sales report Excel export requested (stubbed) for period: ${normalizedPeriod}`);
      
      // ⚠️ In real implementation, use exceljs or similar to generate actual Excel file
      return res.json({ 
        success: true,
        message: 'Excel export would be triggered with current filters applied',
        data: { summary, reportDetails, couponAnalysis }
      });

    } catch (error) {
      logger.error(`Error in Excel export endpoint: ${error.message}`);
      return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Error exporting report to Excel' });
    }
  }
};