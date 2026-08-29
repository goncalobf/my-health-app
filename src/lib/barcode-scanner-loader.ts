type BarcodeReaderModule = typeof import("@/lib/barcode-reader");

let modulePromise: Promise<BarcodeReaderModule> | null = null;

export function loadBarcodeReader(): Promise<BarcodeReaderModule> {
  modulePromise ??= import("@/lib/barcode-reader");
  return modulePromise;
}

export function preloadBarcodeReader(): void {
  void loadBarcodeReader();
}
