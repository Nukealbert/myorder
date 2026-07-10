import * as fs from 'fs';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { barcodeGenerator } from './barcode-generator';

interface PageHeaderData {
  pageNumber: number;
  orderId: string;
  sellerHeader: string;
}

export const pdfWriter = {
  async addHeadersAndBarcodes(
    srcPath: string,
    outputPath: string,
    pagesData: PageHeaderData[],
    barcodeWidth = 140,
    barcodeHeight = 35
  ): Promise<void> {
    if (!fs.existsSync(srcPath)) {
      throw new Error(`Source PDF not found: ${srcPath}`);
    }

    const srcBytes = fs.readFileSync(srcPath);
    const srcDoc = await PDFDocument.load(srcBytes);
    const dstDoc = await PDFDocument.create();

    const helveticaFont = await dstDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBoldFont = await dstDoc.embedFont(StandardFonts.HelveticaBold);

    const copiedPages = await dstDoc.copyPages(srcDoc, srcDoc.getPageIndices());

    for (let i = 0; i < copiedPages.length; i++) {
      const srcPage = copiedPages[i];
      const pageNum = i + 1;
      const dataForPage = pagesData.find(d => d.pageNumber === pageNum);

      const { width, height } = srcPage.getSize();
      const [embeddedPage] = await dstDoc.embedPages([srcDoc.getPages()[i]]);

      if (dataForPage && dataForPage.orderId) {
        // Create a taller page to fit the header
        const headerHeight = 70;
        const newPage = dstDoc.addPage([width, height + headerHeight]);

        // Draw original page content at the bottom
        newPage.drawPage(embeddedPage, {
          x: 0,
          y: 0,
          width: width,
          height: height
        });

        // 1. Draw Seller Header Name
        newPage.drawText(dataForPage.sellerHeader, {
          x: 25,
          y: height + 35,
          size: 14,
          font: helveticaBoldFont
        });

        // 2. Generate and embed barcode
        try {
          const barcodeBuffer = await barcodeGenerator.generateCode128(dataForPage.orderId);
          const barcodeImg = await dstDoc.embedPng(barcodeBuffer);

          // Draw barcode on top-right
          newPage.drawImage(barcodeImg, {
            x: width - barcodeWidth - 25,
            y: height + 25,
            width: barcodeWidth,
            height: barcodeHeight
          });

          // Draw readable Order ID text below barcode
          newPage.drawText(dataForPage.orderId, {
            x: width - barcodeWidth - 25 + (barcodeWidth - helveticaFont.widthOfTextAtSize(dataForPage.orderId, 9)) / 2,
            y: height + 12,
            size: 9,
            font: helveticaFont
          });
        } catch (err) {
          console.error(`Failed to generate barcode for page ${pageNum}:`, err);
          // Just write the Order ID text if barcode fails
          newPage.drawText(`ORDER ID: ${dataForPage.orderId}`, {
            x: width - barcodeWidth - 25,
            y: height + 30,
            size: 11,
            font: helveticaBoldFont
          });
        }
      } else {
        // If no header data, copy the page exactly without adding height or header
        const newPage = dstDoc.addPage([width, height]);
        newPage.drawPage(embeddedPage, {
          x: 0,
          y: 0,
          width: width,
          height: height
        });
      }
    }

    const dstBytes = await dstDoc.save();
    fs.writeFileSync(outputPath, dstBytes);
  }
};
