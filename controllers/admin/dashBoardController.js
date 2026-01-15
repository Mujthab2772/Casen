import { dashboardDetails, salesReportService } from "../../service/admin/dashBoardService.js";
import pdf from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const dashboard = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const info = await dashboardDetails(page);
    
    res.render('dashBoard', {
      totalRevenue: info.totalRevenue[0]?.totalrevenue?.toFixed(2) || 0,
      totalOrder: info.totalOrders,
      totalUser: info.totalUsers,
      productsInStock: info.productsInStock,
      outOfStockProducts: info.outOfStockProducts,
      orderDetail: info.orderDetails,
      pagination: info.pagination
    });
  } catch (error) {
    console.log(`error from dashboard ${error}`);
    res.redirect('/admin/products');
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
      
      if (normalizedPeriod.includes('custom')) {
        normalizedPeriod = 'custom';
      }
      
      let validStartDate = startDate;
      let validEndDate = endDate;
      
      const today = new Date();
      const defaultEndDate = today.toISOString().split('T')[0];
      const lastWeek = new Date();
      lastWeek.setDate(today.getDate() - 6);
      const defaultStartDate = lastWeek.toISOString().split('T')[0];
      
      if (normalizedPeriod === 'custom') {
        if (!startDate || !endDate) {
          validStartDate = defaultStartDate;
          validEndDate = defaultEndDate;
        } 
        else if (new Date(endDate) < new Date(startDate)) {
          validStartDate = endDate;
          validEndDate = startDate;
        }
        else if (new Date(startDate) > today || new Date(endDate) > today) {
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
      
      // Get product sales data with error handling
      let safeProductSalesData;
      try {
        safeProductSalesData = await salesReportService.getProductSalesData(filters);
      } catch (error) {
        console.error('Error fetching product sales data:', error);
        safeProductSalesData = {
          labels: ['No Data'],
          data: [0],
          backgroundColors: ['#e5e7eb'],
          borderColors: ['#9ca3af']
        };
      }

      if (reportDetails.reportData.length === 0) {
        const emptyReportData = [{
          datePeriod: filters.startDate && filters.endDate ? 
            `${new Date(filters.startDate).toLocaleDateString()} - ${new Date(filters.endDate).toLocaleDateString()}` : 
            'No data available',
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
          totalSales: summary.totalSales.toFixed(2),
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
            couponsApplied: reportDetails.reportData.reduce((sum, item) => 
              sum + parseFloat(item.couponsApplied || 0), 0).toFixed(2),
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

      res.render('analytics', { 
        title: 'Sales Reports',
        data: formattedData
      });
    } catch (error) {
      console.error('Error in getSalesReportPage:', error);
      res.status(500).send('Error generating sales report');
    }
  },

  async exportSalesReportPDF(req, res) {
    try {
      const { reportPeriod = 'last7days', startDate, endDate, view = 'weekly' } = req.query;
      
      let normalizedPeriod = reportPeriod.toLowerCase().replace(/\s+/g, '');
      
      if (normalizedPeriod.includes('custom')) {
        normalizedPeriod = 'custom';
      }
      
      const normalizedView = view.toLowerCase().replace(/\s+/g, '');
      
      const filters = { 
        reportPeriod: normalizedPeriod, 
        startDate, 
        endDate, 
        period: normalizedView 
      };
      
      const summary = await salesReportService.getSummaryMetrics(filters);
      const reportDetails = await salesReportService.getSalesReportDetails(filters);
      const couponAnalysis = await salesReportService.getCouponAnalysis(filters);
      
      // Get product sales data
      let productSalesData;
      try {
        productSalesData = await salesReportService.getProductSalesData(filters);
      } catch (error) {
        console.error('Error fetching product sales data for PDF:', error);
        productSalesData = {
          labels: ['No Data'],
          data: [0]
        };
      }

      // Create a new PDF document
      const doc = new pdf({
        size: 'A4',
        margin: 50,
        bufferPages: true
      });

      // Set filename based on date range
      const dateRange = filters.reportPeriod === 'custom' && filters.startDate && filters.endDate
        ? `${filters.startDate}_to_${filters.endDate}`
        : new Date().toISOString().split('T')[0];
      
      const filename = `sales_report_${dateRange}.pdf`;
      
      // Set headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      
      // Pipe the PDF to the response
      doc.pipe(res);

      // Add content to PDF
      // Header with company name
      doc.fontSize(14).text('E-Commerce Dashboard', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(22).text('Sales Report', { align: 'center', bold: true });
      doc.moveDown();
      
      // Add date range
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

      // Helper function to draw tables with borders
      const drawTable = (doc, headers, data, colWidths, startY, options = {}) => {
        const { 
          headerStyle = { font: 'Helvetica-Bold', fontSize: 10 },
          rowStyle = { font: 'Helvetica', fontSize: 10 },
          rowHeight = 25,
          padding = 5
        } = options;
        
        let y = startY;
        const tableWidth = colWidths.reduce((sum, width) => sum + width, 0);
        
        // Draw header
        doc.font(headerStyle.font).fontSize(headerStyle.fontSize);
        headers.forEach((header, i) => {
          const x = 50 + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
          
          // Draw header cell border
          doc.rect(x, y, colWidths[i], rowHeight).stroke();
          
          // Draw header text
          doc.text(header, x + padding, y + padding, {
            width: colWidths[i] - 2 * padding,
            align: 'left'
          });
        });
        y += rowHeight;

        // Draw data rows
        doc.font(rowStyle.font).fontSize(rowStyle.fontSize);
        data.forEach(row => {
          row.forEach((cell, i) => {
            const x = 50 + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
            
            // Draw cell border
            doc.rect(x, y, colWidths[i], rowHeight).stroke();
            
            // Draw cell text
            doc.text(cell, x + padding, y + padding, {
              width: colWidths[i] - 2 * padding,
              align: 'left'
            });
          });
          y += rowHeight;
        });
        
        // Draw bottom border for the last row
        doc.rect(50, y - rowHeight, tableWidth, rowHeight).stroke();
        
        return y;
      };

      // Calculate table widths for proper heading alignment
      const summaryColWidths = [100, 150, 150];
      const summaryTableWidth = summaryColWidths.reduce((a, b) => a + b, 0);
      
      const reportColWidths = [120, 60, 80, 80, 80];
      const reportTableWidth = reportColWidths.reduce((a, b) => a + b, 0);
      
      const productColWidths = [200, 100];
      const productTableWidth = productColWidths.reduce((a, b) => a + b, 0);
      
      const couponColWidths = [120, 60, 100, 100];
      const couponTableWidth = couponColWidths.reduce((a, b) => a + b, 0);

      // Summary Metrics
      doc.fontSize(14).text('Summary', 50, doc.y, { 
        width: summaryTableWidth, 
        align: 'center',
        underline: true 
      });
      doc.moveDown(0.5);
      
      const summaryHeaders = ['Metric', 'Value', 'Change'];
      const summaryData = [
        ['Total Sales', `Rs. ${summary.totalSales.toFixed(2)}`, `${summary.changes.totalSales > 0 ? '+' : ''}${summary.changes.totalSales.toFixed(1)}%`],
        ['Total Orders', summary.totalOrders.toString(), `${summary.changes.totalOrders > 0 ? '+' : ''}${summary.changes.totalOrders.toFixed(1)}%`],
        ['Total Discount', `Rs. ${summary.totalDiscount.toFixed(2)}`, `${summary.changes.totalDiscount < 0 ? '+' : ''}${Math.abs(summary.changes.totalDiscount).toFixed(1)}%`]
      ];
      
      let y = doc.y;
      y = drawTable(doc, summaryHeaders, summaryData, summaryColWidths, y, {
        rowHeight: 22,
        padding: 4
      });
      
      doc.moveDown(1.5);

      // Sales Report Details
      doc.fontSize(14).text('Sales Report Details', 50, doc.y, { 
        width: reportTableWidth, 
        align: 'center',
        underline: true 
      });
      doc.moveDown(0.5);
      
      const reportHeaders = ['Date Period', 'Orders', 'Gross Sales', 'Discounts', 'Net Sales'];
      const reportData = reportDetails.reportData.map(item => [
        item.datePeriod,
        item.orders.toString(),
        `Rs. ${parseFloat(item.grossSales).toFixed(2)}`,
        `Rs. ${parseFloat(item.discounts).toFixed(2)}`,
        `Rs. ${parseFloat(item.netSales).toFixed(2)}`
      ]);
      
      // Add totals row
      reportData.push([
        `Total (${reportData.length} ${reportDetails.period})`,
        reportDetails.reportData.reduce((sum, item) => sum + (item.orders || 0), 0).toString(),
        `Rs. ${reportDetails.reportData.reduce((sum, item) => sum + parseFloat(item.grossSales || 0), 0).toFixed(2)}`,
        `Rs. ${reportDetails.reportData.reduce((sum, item) => sum + parseFloat(item.discounts || 0), 0).toFixed(2)}`,
        `Rs. ${reportDetails.reportData.reduce((sum, item) => sum + parseFloat(item.netSales || 0), 0).toFixed(2)}`
      ]);
      
      y = doc.y;
      y = drawTable(doc, reportHeaders, reportData, reportColWidths, y, {
        rowHeight: 22,
        padding: 4
      });
      
      doc.moveDown(1.5);

      // Product Sales
      doc.fontSize(14).text('Top Selling Products', 50, doc.y, { 
        width: productTableWidth, 
        align: 'center',
        underline: true 
      });
      doc.moveDown(0.5);
      
      const productHeaders = ['Product', 'Units Sold'];
      const productData = productSalesData.labels.map((label, index) => [
        label,
        productSalesData.data[index].toString()
      ]);
      
      y = doc.y;
      y = drawTable(doc, productHeaders, productData, productColWidths, y, {
        rowHeight: 22,
        padding: 4
      });
      
      doc.moveDown(1.5);

      // Coupon Analysis
      if (couponAnalysis.length > 0) {
        doc.fontSize(14).text('Coupon Analysis', 50, doc.y, { 
          width: couponTableWidth, 
          align: 'center',
          underline: true 
        });
        doc.moveDown(0.5);
        
        const couponHeaders = ['Coupon', 'Usage', 'Total Discount', 'Avg. Per Use'];
        const couponData = couponAnalysis.map(coupon => [
          coupon.code,
          coupon.usageCount.toString(),
          `Rs. ${parseFloat(coupon.totalDiscount).toFixed(2)}`,
          `Rs. ${parseFloat(coupon.avgDiscountPerUse).toFixed(2)}`
        ]);
        
        // Add totals row
        const totalUsage = couponAnalysis.reduce((sum, coupon) => sum + coupon.usageCount, 0);
        const totalDiscount = couponAnalysis.reduce((sum, coupon) => sum + parseFloat(coupon.totalDiscount), 0);
        const avgPerUse = totalUsage > 0 ? totalDiscount / totalUsage : 0;
        
        couponData.push([
          'Total',
          totalUsage.toString(),
          `Rs. ${totalDiscount.toFixed(2)}`,
          `Rs. ${avgPerUse.toFixed(2)}`
        ]);
        
        y = doc.y;
        y = drawTable(doc, couponHeaders, couponData, couponColWidths, y, {
          rowHeight: 22,
          padding: 4
        });
      }
      
      // Add footer
      doc.moveDown(2);
      doc.fontSize(8).text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
      
      // Add page number
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        doc.fontSize(8)
           .text(`Page ${i + 1} of ${totalPages}`, 
                  50, 
                  doc.page.height - 45, 
                  { align: 'center' });
      }
      
      // Finalize the PDF
      doc.end();
    } catch (error) {
      console.error('Error in exportSalesReportPDF:', error);
      res.status(500).json({ success: false, message: 'Error exporting report to PDF' });
    }
  },

  async exportSalesReportExcel(req, res) {
    try {
      const { reportPeriod = 'last7days', startDate, endDate, view = 'weekly' } = req.query;
      
      let normalizedPeriod = reportPeriod.toLowerCase().replace(/\s+/g, '');
      
      if (normalizedPeriod.includes('custom')) {
        normalizedPeriod = 'custom';
      }
      
      const normalizedView = view.toLowerCase().replace(/\s+/g, '');
      
      const filters = { 
        reportPeriod: normalizedPeriod, 
        startDate, 
        endDate, 
        period: normalizedView 
      };
      
      const summary = await salesReportService.getSummaryMetrics(filters);
      const reportDetails = await salesReportService.getSalesReportDetails(filters);
      const couponAnalysis = await salesReportService.getCouponAnalysis(filters);
      
      res.json({ 
        success: true,
        message: 'Excel export would be triggered with current filters applied',
        data: {
          summary,
          reportDetails,
          couponAnalysis
        }
      });
    } catch (error) {
      console.error('Error in exportSalesReportExcel:', error);
      res.status(500).json({ success: false, message: 'Error exporting report to Excel' });
    }
  }
};