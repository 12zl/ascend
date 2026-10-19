/* Real face inference stays on the user's device, off the UI thread.
 * Only runtime/model assets are downloaded; no photo is uploaded.
 */
"use strict";
importScripts("./analysis-core.js?v=ai-20261019-3");
const RUNTIME = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1";
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
let detector, loading;
async function getDetector(id) {
  if (detector) return detector;
  if (!loading)
    loading = (async () => {
      postMessage({
        id,
        type: "progress",
        percent: 8,
        stage: "Loading the on-device landmark engine",
      });
      importScripts(`${RUNTIME}/vision_bundle.js`);
      postMessage({
        id,
        type: "progress",
        percent: 22,
        stage: "Downloading the face landmark model",
      });
      const response = await fetch(MODEL);
      if (!response.ok)
        throw new Error(
          "The landmark model could not be downloaded. Check your connection and retry.",
        );
      const bytes = new Uint8Array(await response.arrayBuffer());
      postMessage({
        id,
        type: "progress",
        percent: 45,
        stage: "Preparing WebAssembly inference",
      });
      const files = await Vision.FilesetResolver.forVisionTasks(
        `${RUNTIME}/wasm`,
      );
      detector = await Vision.FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetBuffer: bytes, delegate: "CPU" },
        runningMode: "IMAGE",
        numFaces: 2,
        minFaceDetectionConfidence: 0.6,
        minFacePresenceConfidence: 0.6,
        outputFaceBlendshapes: true,
      });
      return detector;
    })().catch((error) => {
      loading = null;
      throw error;
    });
  return loading;
}
function photoQuality(bitmap, landmarks) {
  const xs = landmarks.map((p) => p.x),
    ys = landmarks.map((p) => p.y),
    left = Math.max(0, Math.min(...xs) * bitmap.width),
    top = Math.max(0, Math.min(...ys) * bitmap.height),
    width = Math.min(
      bitmap.width - left,
      (Math.max(...xs) - Math.min(...xs)) * bitmap.width,
    ),
    height = Math.min(
      bitmap.height - top,
      (Math.max(...ys) - Math.min(...ys)) * bitmap.height,
    );
  const canvas = new OffscreenCanvas(128, 128),
    ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, left, top, width, height, 0, 0, 128, 128);
  const pixels = ctx.getImageData(0, 0, 128, 128).data,
    luma = new Float32Array(128 * 128);
  let sum = 0,
    edge = 0;
  for (let i = 0; i < luma.length; i++) {
    luma[i] =
      pixels[i * 4] * 0.2126 +
      pixels[i * 4 + 1] * 0.7152 +
      pixels[i * 4 + 2] * 0.0722;
    sum += luma[i];
  }
  for (let y = 1; y < 127; y++)
    for (let x = 1; x < 127; x++) {
      const i = y * 128 + x;
      edge += Math.abs(
        4 * luma[i] - luma[i - 1] - luma[i + 1] - luma[i - 128] - luma[i + 128],
      );
    }
  return { brightness: sum / luma.length, sharpness: edge / (126 * 126) };
}
self.onmessage = async (event) => {
  const { id, bitmap } = event.data;
  try {
    const engine = await getDetector(id);
    postMessage({
      id,
      type: "progress",
      percent: 70,
      stage: "Detecting real face landmarks",
    });
    const result = engine.detect(bitmap);
    if (!result.faceLandmarks.length)
      throw new Error(
        "No face detected. Upload one clear, front-facing portrait. No score was generated.",
      );
    if (result.faceLandmarks.length > 1)
      throw new Error(
        "More than one face detected. Crop to one person and try again.",
      );
    postMessage({
      id,
      type: "progress",
      percent: 88,
      stage: "Measuring proportions and checking the photo",
    });
    const face = result.faceLandmarks[0],
      expressions = Object.fromEntries(
        (result.faceBlendshapes[0]?.categories || []).map((c) => [
          c.categoryName,
          c.score,
        ]),
      );
    const report = AscendAnalysis.measure(
      face,
      bitmap.width,
      bitmap.height,
      photoQuality(bitmap, face),
      expressions,
    );
    postMessage({ id, type: "result", report });
  } catch (error) {
    postMessage({
      id,
      type: "error",
      message:
        error.message ||
        "Face analysis could not run. Check your connection and try again.",
    });
  } finally {
    bitmap.close();
  }
};
