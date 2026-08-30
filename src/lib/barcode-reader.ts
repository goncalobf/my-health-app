import { BrowserCodeReader } from "@zxing/browser/esm/readers/BrowserCodeReader";
import BarcodeFormat from "@zxing/library/esm/core/BarcodeFormat";
import DecodeHintType from "@zxing/library/esm/core/DecodeHintType";
import MultiFormatUPCEANReader from "@zxing/library/esm/core/oned/MultiFormatUPCEANReader";

const FOOD_BARCODE_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
];

export const FOOD_BARCODE_CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: "environment" },
    // Browser defaults can select a needlessly large iPhone camera stream.
    // 720p preserves enough detail for an EAN while making every decode much
    // cheaper than scanning a full-resolution camera frame.
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
    aspectRatio: { ideal: 16 / 9 },
  },
};

export function createFoodBarcodeReader() {
  const hints = new Map<DecodeHintType, unknown>();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, FOOD_BARCODE_FORMATS);

  return new BrowserCodeReader(new MultiFormatUPCEANReader(hints), hints, {
    delayBetweenScanAttempts: 120,
    delayBetweenScanSuccess: 120,
    tryPlayVideoTimeout: 4_000,
  });
}
