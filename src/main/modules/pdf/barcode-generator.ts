import bwipjs from 'bwip-js';

export const barcodeGenerator = {
  async generateCode128(text: string, width = 150, height = 50): Promise<Buffer> {
    if (!text) {
      throw new Error('Barcode text is required');
    }

    return new Promise<Buffer>((resolve, reject) => {
      bwipjs.toBuffer({
        bcid: 'code128',       // Barcode type
        text: text,            // Text to encode
        scale: 3,              // Scale factor
        height: 10,            // Bar height, in mm
        includetext: false,    // Do not include text in image (rendered manually)
        textxalign: 'center',
      }, (err: string | Error, png: Buffer) => {
        if (err) {
          reject(err);
        } else {
          resolve(png);
        }
      });
    });
  }
};
