import assert from "node:assert/strict";
import test from "node:test";
import BarcodeFormat from "@zxing/library/esm/core/BarcodeFormat";
import DecodeHintType from "@zxing/library/esm/core/DecodeHintType";
import {
  createFoodBarcodeReader,
  FOOD_BARCODE_CAMERA_CONSTRAINTS,
} from "@/lib/barcode-reader";

test("the food scanner attempts only EAN and UPC formats", () => {
  const reader = createFoodBarcodeReader();
  assert.deepEqual(reader.hints.get(DecodeHintType.POSSIBLE_FORMATS), [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
  ]);
});

test("the food scanner requests a bounded rear-camera stream", () => {
  const video = FOOD_BARCODE_CAMERA_CONSTRAINTS.video;
  assert.notEqual(video, true);
  assert.notEqual(video, false);
  assert.ok(video);
  if (typeof video === "boolean") return;

  assert.deepEqual(video.facingMode, { ideal: "environment" });
  assert.deepEqual(video.width, { ideal: 1280, max: 1920 });
  assert.deepEqual(video.height, { ideal: 720, max: 1080 });
});
