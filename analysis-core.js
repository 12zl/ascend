/* Ascend measurement engine v2. Pure functions shared by the browser worker and tests.
 * Landmark detection is ML; the optional aggregate is an explicitly editorial
 * geometry index. It is not a trained or validated attractiveness model.
 * No filename, hash, identity, glasses classifier, or demographic input is used.
 */
(function (root) {
  "use strict";
  const ENGINE = "landmarks-v2";
  const clamp = (n, low, high) => Math.min(high, Math.max(low, n));
  const round = (n, places = 2) => Number(n.toFixed(places));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const band = (value, center, tolerance) =>
    Math.round(
      clamp(100 - (Math.abs(value - center) / tolerance) * 35, 1, 100),
    );
  function measure(
    landmarks,
    width,
    height,
    imageQuality = {},
    expressions = {},
  ) {
    if (
      !Array.isArray(landmarks) ||
      landmarks.length < 468 ||
      !landmarks.every(
        (p) =>
          Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z),
      )
    )
      throw new Error(
        "The face landmarks could not be read. Try another clear photo.",
      );
    const raw = landmarks.map((p) => ({
      x: p.x * width,
      y: p.y * height,
      z: p.z * width,
    }));
    const roll = Math.atan2(raw[263].y - raw[33].y, raw[263].x - raw[33].x);
    const origin = {
      x: (raw[33].x + raw[263].x) / 2,
      y: (raw[33].y + raw[263].y) / 2,
    };
    const p = raw.map((q) => ({
      x: (q.x - origin.x) * Math.cos(roll) + (q.y - origin.y) * Math.sin(roll),
      y: -(q.x - origin.x) * Math.sin(roll) + (q.y - origin.y) * Math.cos(roll),
      z: q.z,
    }));
    const faceWidth = distance(p[234], p[454]),
      faceHeight = distance(p[10], p[152]);
    if (faceWidth < 1 || faceHeight < 1)
      throw new Error(
        "The face is too small to measure. Move closer and try again.",
      );
    const yaw =
      (Math.atan2(p[234].z - p[454].z, Math.abs(p[454].x - p[234].x)) * 180) /
      Math.PI;
    const jawRatio = distance(p[172], p[397]) / faceWidth;
    const lowerHeight = distance(p[2], p[152]);
    const chinRatio = distance(p[17], p[152]) / Math.max(1, lowerHeight);
    const brow = { x: (p[105].x + p[334].x) / 2, y: (p[105].y + p[334].y) / 2 };
    const midRatio = distance(brow, p[2]) / Math.max(1, lowerHeight);
    const eyeRatio =
      (distance(p[33], p[133]) / Math.max(1, distance(p[159], p[145])) +
        distance(p[362], p[263]) / Math.max(1, distance(p[386], p[374]))) /
      2;
    const leftTilt =
      (-Math.atan2(p[33].y - p[133].y, Math.abs(p[33].x - p[133].x)) * 180) /
      Math.PI;
    const rightTilt =
      (-Math.atan2(p[263].y - p[362].y, Math.abs(p[263].x - p[362].x)) * 180) /
      Math.PI;
    const tilt = (leftTilt + rightTilt) / 2;
    const midline = (p[168].x + p[152].x) / 2;
    const pairs = [
      [33, 263],
      [133, 362],
      [61, 291],
      [234, 454],
      [172, 397],
    ];
    const error =
      pairs.reduce(
        (sum, [a, b]) =>
          sum +
          (Math.abs(p[a].x - midline + (p[b].x - midline)) +
            Math.abs(p[a].y - p[b].y)) /
            faceWidth,
        0,
      ) / pairs.length;
    const symmetry = Math.round(clamp(100 - error * 250, 1, 100));
    const warnings = [];
    let confidence = 96;
    if (Math.abs(yaw) > 15) {
      warnings.push({
        code: "pose",
        title: "Face the camera squarely",
        detail: `Estimated head turn: ${Math.round(Math.abs(yaw))}°. Perspective changes the visible proportions. Take a straight-on photo.`,
        severity: Math.abs(yaw) > 25 ? "High" : "Medium",
      });
      confidence -= Math.min(35, Math.abs(yaw) * 0.8);
    }
    if (Math.abs((roll * 180) / Math.PI) > 12) {
      warnings.push({
        code: "roll",
        title: "Level your head",
        detail:
          "The eye line was rotated mathematically before measurement. A level, straight-on capture is still easier to compare.",
        severity: "Low",
      });
      confidence -= 5;
    }
    if (faceWidth < 150) {
      warnings.push({
        code: "size",
        title: "Bring the face closer",
        detail: `Detected cheek-to-cheek width is ${Math.round(faceWidth)} pixels. Use a closer, higher-resolution photo for more stable landmarks.`,
        severity: faceWidth < 85 ? "High" : "Medium",
      });
      confidence -= faceWidth < 85 ? 35 : 15;
    }
    const light = imageQuality.brightness ?? 128,
      sharp = imageQuality.sharpness ?? 35;
    if (light < 55 || light > 220) {
      warnings.push({
        code: "light",
        title: "Use softer, even lighting",
        detail:
          light < 55
            ? "The face region is underexposed. Move toward soft front-facing light."
            : "The face region is overexposed. Reduce direct light to preserve facial detail.",
        severity: "Medium",
      });
      confidence -= 15;
    }
    if (sharp < 8) {
      warnings.push({
        code: "blur",
        title: "Retake a sharper photo",
        detail:
          "The face crop has little high-frequency detail. Clean the lens, hold still, and use the original image rather than a compressed screenshot.",
        severity: "Medium",
      });
      confidence -= 15;
    }
    const expression = Math.max(
      expressions.jawOpen ?? 0,
      expressions.mouthSmileLeft ?? 0,
      expressions.mouthSmileRight ?? 0,
    );
    if (expression > 0.35) {
      warnings.push({
        code: "expression",
        title: "Use a neutral expression",
        detail:
          "The expression detector found visible mouth movement or a smile. This affects lower-face and eye proportions.",
        severity: "Medium",
      });
      confidence -= 10;
    }
    confidence = Math.round(clamp(confidence, 15, 99));
    const canScore = Math.abs(yaw) < 30 && confidence >= 55 && faceWidth >= 85;
    const metrics = [
      {
        id: "jaw",
        name: "Jaw width",
        value: band(jawRatio, 0.78, 0.2),
        raw: round(jawRatio),
        unit: "× cheek width",
        note: "2D jaw-to-cheek width; not jaw projection",
        weight: 0.2,
      },
      {
        id: "chin",
        name: "Chin proportion",
        value: band(chinRatio, 0.5, 0.2),
        raw: round(chinRatio),
        unit: "× lower face",
        note: "Lower lip to chin / nose base to chin",
        weight: 0.15,
      },
      {
        id: "midface",
        name: "Midface balance",
        value: band(midRatio, 0.9, 0.35),
        raw: round(midRatio),
        unit: "× lower third",
        note: "Brow-to-nose / nose-to-chin distance",
        weight: 0.2,
      },
      {
        id: "eyes",
        name: "Eye aspect ratio",
        value: band(eyeRatio, 3.2, 1.5),
        raw: round(eyeRatio),
        unit: "width / height",
        note: "Mean visible eye width-to-height ratio",
        weight: 0.15,
      },
      {
        id: "tilt",
        name: "Canthal tilt",
        value: band(tilt, 4, 12),
        raw: round(tilt, 1),
        unit: "degrees",
        note: "Eye-corner angle, corrected for head roll",
        weight: 0.1,
      },
      {
        id: "symmetry",
        name: "Projected symmetry",
        value: symmetry,
        raw: symmetry,
        unit: "% index",
        note: "2D paired-point alignment; pose-sensitive",
        weight: 0.2,
      },
      {
        id: "skin",
        name: "Skin quality",
        value: null,
        raw: null,
        unit: "Not assessed",
        note: "Landmarks do not measure skin condition",
        weight: 0,
      },
      {
        id: "hair",
        name: "Hairline & framing",
        value: null,
        raw: null,
        unit: "Not assessed",
        note: "No hair segmentation model is installed",
        weight: 0,
      },
    ];
    const geometry = canScore
      ? Math.round(
          metrics.reduce((sum, m) => sum + (m.value ?? 0) * m.weight, 0),
        )
      : null;
    return {
      engine: ENGINE,
      resting: null,
      geometry,
      potential: null,
      confidence,
      tilt: round(tilt, 1),
      yaw: round(yaw, 1),
      roll: round((roll * 180) / Math.PI, 1),
      metrics,
      warnings,
      landmarkCount: landmarks.length,
      points: landmarks.map((q) => [round(q.x, 5), round(q.y, 5)]),
      imageWidth: width,
      imageHeight: height,
      quality: { brightness: round(light, 1), sharpness: round(sharp, 1) },
      formula:
        "Jaw 20% + chin 15% + midface 20% + eye aspect 15% + tilt 10% + projected symmetry 20%. Editorial reference bands; not a calibrated beauty score.",
    };
  }
  root.AscendAnalysis = { ENGINE, measure };
  if (typeof module !== "undefined" && module.exports)
    module.exports = root.AscendAnalysis;
})(typeof self !== "undefined" ? self : globalThis);
