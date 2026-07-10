import * as fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

export interface ParsedPageText {
  pageNumber: number;
  text: string;
}

export const pdfReader = {
  async extractText(filePath: string, onProgress?: (current: number, total: number) => void): Promise<ParsedPageText[]> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    const data = new Uint8Array(fs.readFileSync(filePath));
    const loadingTask = pdfjsLib.getDocument({
      data,
      useSystemFonts: true,
      disableFontFace: true // avoids DOM font face registration errors in Node
    });

    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;
    const pages: ParsedPageText[] = [];

    for (let i = 1; i <= totalPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      
      // Join strings from items
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join('\n'); // join with newline to preserve lines better

      pages.push({
        pageNumber: i,
        text: pageText
      });

      if (onProgress) {
        onProgress(i, totalPages);
      }
    }

    return pages;
  }
};
