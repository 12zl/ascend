/* Ascend — buildless application with real on-device vision inference.
 * MediaPipe measures geometry; Qwen3-VL / SmolVLM generate subjective appearance estimates.
 * Neither the image hash nor the geometry formula generates an AI rating.
 */
"use strict";

(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [
    ...root.querySelectorAll(selector),
  ];
  const escapeHTML = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const STORAGE_KEY = "ascend.workspace.v1";
  const MAX_PHOTOS = 20;
  const paths = {
    grid: "M3 3h6v6H3z M15 3h6v6h-6z M3 15h6v6H3z M15 15h6v6h-6z",
    scan: "M8 3H3v5 M16 3h5v5 M3 16v5h5 M21 16v5h-5 M7 12h10 M12 7v10",
    chart: "M3 3v18h18 M6 15l4-5 4 2 6-7",
    check: "M9 4H4v16h16V9 M8 11l4 4L21 4",
    sun: "M12 3v1 M12 20v1 M3 12h1 M20 12h1 M5.6 5.6l.8.8 M17.6 17.6l.8.8 M5.6 18.4l.8-.8 M17.6 6.4l.8-.8 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    body: "M15 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M9 10l-4 2-1 7 M15 10l4 2 1 7 M8 12l1 6-1 5 M16 12l-1 6 1 5 M9 18h6",
    spark:
      "M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z M20 2v4 M18 4h4",
    book: "M12 5C8 2 3 4 3 4v15s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1z M12 5v15",
    settings:
      "M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
    help: "M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 3 M12 17h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    lock: "M6 10h12v11H6z M8 10V6a4 4 0 0 1 8 0v4 M12 14v3",
    face: "M6 3c-4 6-2 14 2 17l4 2 4-2c4-3 6-11 2-17 M7 9h3 M14 9h3 M12 10v5h2 M9 18h6",
    trend: "M3 17l6-6 4 4 8-10 M15 5h6v6",
    droplet:
      "M12 2C9 7 4 11 4 15a8 8 0 0 0 16 0c0-4-5-8-8-13z M8 14a4 4 0 0 0 4 5",
    info: "M12 10v7 M12 7h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    upload: "M12 16V3 M7 8l5-5 5 5 M4 15v6h16v-6",
    search: "M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0 M15 15l6 6",
    scissors:
      "M8 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M8 17a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M7 8l14 12 M7 16L21 3",
    shirt: "M8 3l4 2 4-2 6 5-4 4-2-2v11H8V10l-2 2-4-4z",
    moon: "M21 13a9 9 0 1 1-10-10c-4 7 2 13 10 10",
    camera: "M8 6l2-3h4l2 3h5v15H3V6z M16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  };
  const icon = (name) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.spark}"/></svg>`;
  function hydrateIcons(root = document) {
    $$("[data-icon]", root).forEach((el) => {
      el.innerHTML = icon(el.dataset.icon);
    });
  }

  const DEFAULT_HABITS = [
    { id: "skin-am", name: "Morning skincare + SPF", category: "SKIN" },
    { id: "move", name: "A little movement, every day", category: "WELLBEING" },
    { id: "skin-pm", name: "Evening cleanse & moisturize", category: "SKIN" },
  ];
  const DEFAULT_PLAN = ["skin", "grooming", "photo"];
  const freshState = () => ({
    version: 1,
    profile: {
      name: "",
      goal: "consistency",
      savePhotos: true,
      reduceMotion: false,
      style: "minimal",
    },
    scans: [],
    habits: DEFAULT_HABITS.map((h) => ({ ...h })),
    checks: {},
    plan: DEFAULT_PLAN.slice(),
    completed: [],
  });
  // Local date boundaries, so a daily check-in resets at the user's midnight.
  const dateKey = (date = new Date()) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const formatDate = (value, options = {}) =>
    new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      ...options,
    }).format(new Date(value));
  let state = freshState();
  let filter = "all",
    search = "",
    selectedPhoto = null,
    stream = null,
    runId = 0,
    toastTimer,
    activeRoute = "";
  let lastDate = dateKey();
  const scanDialog = $("#scan-dialog");

  // Strictly validate persisted/imported content; all user text is escaped at render time.
  function validateState(raw) {
    if (
      !raw ||
      raw.version !== 1 ||
      !Array.isArray(raw.scans) ||
      !Array.isArray(raw.habits)
    )
      throw new Error("Not an Ascend backup");
    const next = freshState(),
      p = raw.profile || {};
    next.profile = {
      name: String(p.name || "").slice(0, 40),
      goal: ["consistency", "skin", "style", "progress"].includes(p.goal)
        ? p.goal
        : "consistency",
      savePhotos: p.savePhotos !== false,
      reduceMotion: p.reduceMotion === true,
      style: ["minimal", "textured", "classic"].includes(p.style)
        ? p.style
        : "minimal",
    };
    next.scans = raw.scans
      .slice(-MAX_PHOTOS)
      .filter(
        (s) =>
          s &&
          /^scan-[\w-]+$/.test(s.id) &&
          (Number.isFinite(s.seed) || s.report?.engine === "landmarks-v2") &&
          Number.isFinite(new Date(s.date).getTime()),
      )
      .map((s) => ({
        id: s.id,
        date: new Date(s.date).toISOString(),
        seed: Number.isFinite(s.seed) ? s.seed >>> 0 : null,
        report: sanitizeReport(s.report),
        photo:
          next.profile.savePhotos &&
          typeof s.photo === "string" &&
          /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(s.photo) &&
          s.photo.length < 600000
            ? s.photo
            : null,
      }));
    const habitIds = new Set();
    next.habits = raw.habits
      .slice(0, 30)
      .filter(
        (h) =>
          h &&
          /^[\w-]{1,70}$/.test(h.id) &&
          !habitIds.has(h.id) &&
          habitIds.add(h.id),
      )
      .map((h) => ({
        id: h.id,
        name: String(h.name || "Daily habit").slice(0, 65),
        category: String(h.category || "PERSONAL").slice(0, 15),
      }));
    next.checks = {};
    Object.entries(raw.checks || {})
      .slice(-730)
      .forEach(([day, ids]) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(day) && Array.isArray(ids))
          next.checks[day] = [
            ...new Set(
              ids.filter(
                (id) => typeof id === "string" && /^[\w-]{1,70}$/.test(id),
              ),
            ),
          ].slice(0, 30);
      });
    next.plan = Array.isArray(raw.plan)
      ? [
          ...new Set(raw.plan.filter((id) => FIXES.some((f) => f.id === id))),
        ].slice(0, 8)
      : DEFAULT_PLAN.slice();
    next.completed = Array.isArray(raw.completed)
      ? raw.completed.filter((id) => next.plan.includes(id))
      : [];
    return next;
  }
  // FIXES is read by validation, so state loading is deferred until after data declarations.
  function restoreState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      state = saved ? validateState(JSON.parse(saved)) : freshState();
    } catch {
      toast("Your workspace could not be restored. A fresh session is ready.");
    }
  }
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch {
      toast(
        "Storage is full or unavailable. Export a backup to keep this session.",
      );
      return false;
    }
  }
  function toast(message) {
    clearTimeout(toastTimer);
    $("#toast").textContent = message;
    $("#toast").classList.add("show");
    toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 3600);
  }

  const METRICS = [
    { id: "jaw", name: "Jaw definition", note: "Lower-face contour example" },
    { id: "chin", name: "Chin balance", note: "Profile proportion example" },
    { id: "midface", name: "Midface balance", note: "Facial thirds example" },
    { id: "eyes", name: "Eye area", note: "Eye framing example" },
    { id: "tilt", name: "Canthal tilt", note: "Simulated angle approximation" },
    {
      id: "symmetry",
      name: "Facial symmetry",
      note: "Left–right balance example",
    },
    { id: "skin", name: "Skin quality", note: "Surface appearance example" },
    { id: "hair", name: "Hairline & framing", note: "Hair framing example" },
  ];
  const FIXES = [
    {
      id: "skin",
      title: "Build a consistent skin foundation",
      observation: "Example concern: uneven-looking skin texture and tone.",
      severity: "Medium",
      priority: "01",
      time: "5 min daily",
      category: "SKIN",
      action:
        "Use a gentle cleanser and a moisturizer suited to your skin. In the morning, add broad-spectrum SPF 30 or higher. Keep the routine simple and track consistency before adding more products.",
      metric: "skin",
      article: "skin",
      habit: { name: "Morning skincare + SPF", category: "SKIN" },
    },
    {
      id: "grooming",
      title: "Give your face a more intentional frame",
      observation:
        "Example concern: hair and facial-hair framing could be more defined.",
      severity: "Low",
      priority: "02",
      time: "Weekly",
      category: "GROOMING",
      action:
        "Save two haircut references and discuss the shape with your barber. Try a tidy neckline, balanced side volume, and a defined beard edge if you wear facial hair. For hairline coverage, compare a textured cut with a professionally fitted hair system.",
      metric: "hair",
      article: "hair",
      habit: { name: "Hair & grooming check", category: "GROOMING" },
    },
    {
      id: "photo",
      title: "Standardize your progress photos",
      observation:
        "Example concern: lighting and camera position change perceived symmetry.",
      severity: "Low",
      priority: "03",
      time: "Monthly",
      category: "TRACKING",
      action:
        "Use the same camera, distance, neutral expression, and soft front-facing light for every check-in. Keep the camera at eye level and avoid a close wide-angle selfie. Record one front view and one profile for your own comparison.",
      metric: "symmetry",
      article: "photos",
      habit: {
        name: "Check in with a consistent progress photo",
        category: "TRACKING",
      },
    },
    {
      id: "eyes",
      title: "Refine the eye-area presentation",
      observation:
        "Example concern: inconsistent brow framing and under-eye lighting.",
      severity: "Low",
      priority: "04",
      time: "Weekly",
      category: "GROOMING",
      action:
        "Keep your brow shape natural and tidy stray hairs. Try glasses with a bridge and frame width that sit comfortably. Use even light for photos; an image-based angle estimate is not a reason to change eye anatomy.",
      metric: "eyes",
      article: "style",
      habit: { name: "Brow & eyewear grooming check", category: "GROOMING" },
    },
    {
      id: "jaw",
      title: "Explore lower-face balance thoughtfully",
      observation:
        "Example concern: lower-face definition is a selected area of focus.",
      severity: "Low",
      priority: "05",
      time: "Consultation",
      category: "STRUCTURE",
      action:
        "Try a different beard length or haircut silhouette first. If bite alignment is a concern, book an orthodontic assessment. For questions about chin fillers, bring goals to a licensed clinician for an in-person assessment; landmark ratios do not establish a need for a procedure.",
      metric: "jaw",
      article: "structure",
      habit: {
        name: "Compare lower-face grooming references",
        category: "GROOMING",
      },
    },
    {
      id: "body",
      title: "Support your broader fitness goals",
      observation:
        "Example concern: a consistent movement routine is not yet established.",
      severity: "Low",
      priority: "06",
      time: "Daily",
      category: "WELLBEING",
      action:
        "Choose an enjoyable movement habit and track it consistently. If fat loss is one of your own goals, build a sustainable plan with a qualified professional. A face photo cannot establish body fat or whether weight loss is appropriate.",
      metric: "chin",
      article: "structure",
      habit: { name: "A little movement, every day", category: "WELLBEING" },
    },
  ];
  const ARTICLES = [
    {
      id: "skin",
      category: "skin",
      icon: "droplet",
      title: "The everyday skin foundation",
      desc: "A simple routine you can actually repeat.",
      time: "4 min",
      body: `<p>Consistency starts with a routine that fits an ordinary morning and evening.</p><h3>Morning: cleanse, moisturize, protect</h3><p>Choose a gentle cleanser and a moisturizer that suit your skin. Finish with broad-spectrum sunscreen of SPF 30 or higher. Follow the product directions, including reapplication when outdoors.</p><h3>Evening: keep it simple</h3><p>Cleanse and moisturize. Introduce one new product at a time so you can notice how your skin responds.</p><h3>Make it repeatable</h3><p>Keep your daily essentials together and check them off in your Ascend routine.</p><p>Further reading: <a href="https://www.aad.org/public/everyday-care/sun-protection/shade-clothing-sunscreen/how-to-select-sunscreen" target="_blank" rel="noopener noreferrer">American Academy of Dermatology: choosing sunscreen ↗</a></p>`,
    },
    {
      id: "structure",
      category: "structure",
      icon: "face",
      title: "Jawline: structure, posture & perspective",
      desc: "Understand the options before choosing a direction.",
      time: "5 min",
      body: `<p>Hair, facial hair, expression, camera perspective, and light all affect the way your lower face appears in a photo.</p><h3>Start with presentation</h3><p>Compare a few beard lengths, a clean neckline, and a haircut with different side volume. Use consistent camera distance when judging the result.</p><h3>Mewing & orthodontics</h3><p>Mewing is often promoted as a jaw-sculpting method, but the American Association of Orthodontists reports that these claims lack scientific support. An orthodontic assessment is the appropriate route for questions about bite or tooth alignment.</p><h3>Fillers & other procedures</h3><p>If you want to explore chin or jaw fillers, discuss goals, alternatives, suitability, and risks with a licensed clinician in person. A geometry index cannot determine an indication or predict a result.</p><h3>Fitness & fat loss</h3><p>If changing body composition is your personal goal, discuss a sustainable approach with a qualified professional. Ascend does not estimate body fat from a facial photo.</p><p>Further reading: <a href="https://aaoinfo.org/whats-trending/is-mewing-bad-for-you/" target="_blank" rel="noopener noreferrer">American Association of Orthodontists: mewing explained ↗</a></p>`,
    },
    {
      id: "hair",
      category: "style",
      icon: "scissors",
      title: "The art of framing your face",
      desc: "Hair, facial hair, and the details that bring balance.",
      time: "4 min",
      body: `<p>A good haircut starts with your hair texture, lifestyle, and the silhouette you want to create.</p><h3>Bring references, not ratios</h3><p>Save a front and side view of two styles you like. Ask your barber how to adapt their volume and length to your texture. Compare results with consistent photos.</p><h3>Build a grooming rhythm</h3><p>Tidy your neckline and facial-hair edges. Use a small amount of styling product and adjust gradually.</p><h3>Hairline coverage options</h3><p>Try a textured fringe, different parting, or a shorter cut. For a hair system, ask a professional fitter about appearance, attachment, upkeep, cost, and a sample fitting before deciding.</p>`,
    },
    {
      id: "photos",
      category: "structure",
      icon: "camera",
      title: "A better progress photo",
      desc: "Make each check-in easier to compare.",
      time: "3 min",
      body: `<p>The most useful progress photo is the one you can reproduce.</p><h3>Set up once</h3><p>Place your camera at eye level, use soft front-facing daylight, and keep the same distance. Mark a position on the floor if it helps.</p><h3>Repeat your conditions</h3><p>Use a neutral expression and the same lens. Avoid switching between a close selfie and a distant portrait.</p><h3>Track the right thing</h3><p>Add a new scan to your timeline and compare your own photos over time. Ascend geometry indices depend on pose and expression; compare your photos as well as the raw measurements.</p>`,
    },
    {
      id: "style",
      category: "style",
      icon: "shirt",
      title: "A personal style, with intention",
      desc: "Find your silhouette and simplify the details.",
      time: "4 min",
      body: `<p>Start with clothes you enjoy wearing. Look for a silhouette and color palette you can repeat.</p><h3>Fit before everything</h3><p>Check shoulder seams, sleeve length, and trouser break. Try one size up or down and compare full-length photos in the same light.</p><h3>A smaller, stronger palette</h3><p>Choose two neutrals and one accent. Match metals across glasses, a watch, or jewelry for a more cohesive finish.</p><h3>Frame the eyes</h3><p>Try eyewear with a comfortable bridge and width. Keep brows natural and tidy stray hairs; aim for the look you prefer rather than a numerical angle.</p>`,
    },
    {
      id: "simulation",
      category: "structure",
      icon: "scan",
      title: "Inside the Ascend scan",
      desc: "What your report is showing you.",
      time: "2 min",
      body: `<p>Two independent vision engines run on your device. A vision-language model reads a face crop and generates subjective appearance estimates; MediaPipe detects 478 facial landmarks for visible measurements.</p><h3>How AI ratings work</h3><p>Choose the stronger Qwen3-VL 2B model (about 1.4 GB of weights) or the smaller 500M model (about 400 MB). Transformers.js 4.3.1 runs their quantized ONNX weights through WebGPU. The app asks separately for a current appearance score, a grooming-potential score, and visible grooming suggestions. Greedy decoding is used. Only valid numeric answers from 1 to 100 appear in the gauges. Inspect the actual generated answers in every AI report.</p><p>These general vision-language models were not trained or validated as beauty benchmarks. Their opinions can be inaccurate, biased, or insensitive to differences a person would notice. Potential is a styling scenario; no anatomy change or treatment outcome is predicted.</p><h3>Repeatable scans</h3><p>An identical processed photo, model mode and rubric reuses its saved AI result. An image fingerprint is used only for cache lookup. It never generates a rating. Changing the photo can change the model’s response. Old simulated ratings are excluded from history.</p><h3>Separate geometry reference bands</h3><p>Each optional index is clamp(100 − 35 × |measurement − reference| / tolerance, 1, 100). Jaw width: reference 0.78, tolerance 0.20, weight 20%. Chin proportion: 0.50, 0.20, 15%. Midface / lower third: 0.90, 0.35, 20%. Eye aspect: 3.2, 1.5, 15%. Mean canthal tilt: 4°, 12°, 10%. Projected symmetry: 100 − 250 × mean paired-point error / cheek width, weight 20%. These editorial references do not calculate the AI score.</p><h3>Privacy & compatibility</h3><p>No photo is uploaded. Only public runtime, WASM and model files are downloaded from jsDelivr, Google and Hugging Face. Model files are cached when the browser allows it. A compatible WebGPU device and enough memory are required for AI mode. Otherwise, use lightweight measurements. Failed inference never triggers a simulated rating.</p><p><a href="https://huggingface.co/Qwen/Qwen3-VL-2B-Instruct" target="_blank" rel="noopener noreferrer">Qwen3-VL model documentation ↗</a> · <a href="https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js" target="_blank" rel="noopener noreferrer">MediaPipe documentation ↗</a></p>`,
    },
  ];

  function sanitizeReport(r) {
    if (
      r?.engine !== "landmarks-v2" ||
      !Array.isArray(r.metrics) ||
      r.metrics.length !== 8
    )
      return null;
    const numeric = (v, lo, hi) =>
      Number.isFinite(v) && v >= lo && v <= hi ? v : null;
    const text = (v) => String(v ?? "").slice(0, 500);
    let ai = null;
    if (
      [
        "HuggingFaceTB/SmolVLM-500M-Instruct",
        "HuggingFaceTB/SmolVLM-Instruct",
        "onnx-community/Qwen3-VL-2B-Instruct-ONNX",
      ].includes(r.ai?.model) &&
      r.ai?.rubric === AscendRating.RUBRIC
    ) {
      try {
        ai = {
          ...AscendRating.parseOutputs(r.ai.raw),
          model: r.ai.model,
          revision: text(r.ai.revision),
          rubric: r.ai.rubric,
          raw: String(r.ai.raw).slice(0, 7000),
          device: "webgpu",
        };
      } catch {
        /* Never replace invalid AI output with a fabricated rating. */
      }
    }
    return {
      engine: "landmarks-v2",
      ai,
      aiCached: r.aiCached === true,
      aiError: text(r.aiError),
      aiRaw: String(r.aiRaw || "").slice(0, 7000),
      cacheKey: /^[a-f0-9]{64}$/.test(r.cacheKey) ? r.cacheKey : null,
      resting: ai?.resting ?? null,
      geometry: numeric(r.ai ? r.geometry : (r.geometry ?? r.resting), 1, 100),
      potential: ai?.potential ?? null,
      confidence: numeric(r.confidence, 0, 100) ?? 0,
      tilt: numeric(r.tilt, -90, 90),
      yaw: numeric(r.yaw, -90, 90),
      roll: numeric(r.roll, -180, 180),
      landmarkCount: numeric(r.landmarkCount, 468, 478) ?? 478,
      imageWidth: numeric(r.imageWidth, 1, 4096) ?? 640,
      imageHeight: numeric(r.imageHeight, 1, 4096) ?? 640,
      metrics: r.metrics.map((m, i) => ({
        id: METRICS[i].id,
        name: text(m.name),
        value: numeric(m.value, 1, 100),
        raw: numeric(m.raw, -1000, 1000),
        unit: text(m.unit),
        note: text(m.note),
        weight: numeric(m.weight, 0, 1) ?? 0,
      })),
      warnings: (Array.isArray(r.warnings) ? r.warnings : [])
        .slice(0, 8)
        .map((w) => ({
          code: text(w.code),
          title: text(w.title),
          detail: text(w.detail),
          severity: ["High", "Medium", "Low"].includes(w.severity)
            ? w.severity
            : "Low",
        })),
      points: (Array.isArray(r.points) ? r.points : [])
        .slice(0, 478)
        .filter(
          (p) =>
            Array.isArray(p) &&
            p.length === 2 &&
            p.every((n) => numeric(n, -2, 2) !== null),
        ),
      formula: text(r.formula),
    };
  }
  const emptyReport = {
    resting: null,
    geometry: null,
    ai: null,
    potential: null,
    confidence: 0,
    metrics: METRICS.map((m) => ({
      ...m,
      value: null,
      raw: null,
      unit: "Awaiting scan",
      note: "Upload a photo to measure this feature",
    })),
    warnings: [],
  };
  function currentScan() {
    return state.scans
      .filter((s) => s.report?.engine === "landmarks-v2")
      .at(-1);
  }
  function currentReport() {
    return currentScan()?.report ?? emptyReport;
  }
  function scoreGauge(value, kind, label) {
    return `<div class="gauge ${kind === "potential" ? "potential" : ""}" style="--value:${value ?? 0}" role="img" aria-label="${label}: ${value === null ? "not available" : value + " out of 100"}"><div><strong>${value ?? "—"}</strong><span>${value === null ? "NOT SCORED" : "/ 100"}</span></div></div>`;
  }

  const sampleFace = () =>
    `<div class="demo-face" aria-label="Illustrative face outline">${`<svg viewBox="0 0 130 190" fill="none"><path d="M65 5C24 4 12 37 18 80l8 39 18 25 21 11 21-11 18-25 8-39C118 37 106 4 65 5Z M20 63l25-15 20 7 20-7 25 15 M22 83l23 8 20-9 20 9 23-8 M28 118l23-7 14 6 14-6 23 7 M45 143l20-10 20 10 M45 49l-7 29 15 8 12-31 12 31 15-8-7-29 M65 82v28l-10 8 10 4 10-4-10-8 M45 133l20-5 20 5 M32 67l13-5 12 6 M73 68l12-6 13 5 M45 155l-2 18-30 15 M85 155l2 18 30 15 M43 173l22 12 22-12 M18 80l47 53 47-53 M26 119l39-64 39 64" stroke="currentColor"/><g fill="currentColor">${[
      [65, 5],
      [20, 63],
      [45, 49],
      [85, 49],
      [110, 63],
      [38, 78],
      [92, 78],
      [65, 82],
      [65, 110],
      [45, 133],
      [85, 133],
      [65, 155],
    ]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.4"/>`)
      .join("")}</g></svg>`}</div>`;
  function photoMarkup(photo, alt) {
    return photo
      ? `<img src="${photo}" alt="${escapeHTML(alt)}" loading="lazy">`
      : sampleFace();
  }

  function renderOverview() {
    const report = currentReport();
    for (const name of ["resting", "potential"]) {
      const value = report[name];
      $("#" + name + "-score").textContent = value ?? "—";
      const gauge = $("#" + name + "-gauge");
      gauge.style.setProperty("--value", value ?? 0);
      gauge.setAttribute("role", "img");
      gauge.setAttribute(
        "aria-label",
        name + " subjective AI estimate: " + (value ?? "not scored"),
      );
    }
    $("#resting-caption").textContent = report.ai
      ? "Subjective AI appearance estimate"
      : "Run browser AI to receive a rating";
    $("#potential-caption").textContent = report.ai
      ? "AI grooming & presentation estimate"
      : "Awaiting browser AI";
    $("#report-badge").textContent = report.ai
      ? "ON-DEVICE AI REPORT"
      : currentScan()
        ? "MEASURED LANDMARKS"
        : "YOUR FIRST SCAN AWAITS";
    renderHabits();
  }
  function landmarkOverlay(r) {
    if (!r.points?.length) return "";
    const w = r.imageWidth,
      h = r.imageHeight,
      point = (i) =>
        r.points[i] ? r.points[i][0] * w + "," + r.points[i][1] * h : "";
    const lines = [
      [234, 172, 152, 397, 454],
      [33, 160, 158, 133, 153, 144, 33],
      [362, 385, 387, 263, 373, 380, 362],
      [105, 2, 152],
      [61, 13, 291, 14, 61],
    ];
    return `<svg class="landmark-overlay" viewBox="0 0 ${w} ${h}" aria-label="Detected facial landmarks" role="img">${lines.map((line) => '<polyline points="' + line.map(point).join(" ") + '"/>').join("")}${r.points
      .filter((p, i) => i % 5 === 0)
      .map(
        (p) => '<circle cx="' + p[0] * w + '" cy="' + p[1] * h + '" r="1.1"/>',
      )
      .join("")}</svg>`;
  }
  function renderAnalysis() {
    const scan = currentScan(),
      r = currentReport();
    $("#simulation-label").textContent = scan
      ? "On-device ML landmarks · " +
        r.landmarkCount +
        " detected points · capture confidence " +
        r.confidence +
        "%"
      : "Real landmark analysis. Browser AI scores one detected face locally.";
    if (!scan) {
      const legacy = state.scans.filter((s) => !s.report).length;
      $("#analysis-content").innerHTML =
        `<div class="empty-state">${icon("scan")}<h2>Measure your features.</h2><p>Run a real vision model locally, inspect measured facial proportions, and build your next routine.${legacy ? " Your " + legacy + " legacy scan photos are still in My progress for rescanning." : ""}</p><button class="button button-green" data-open-scan>Start a real face scan ↗</button></div>`;
      return;
    }
    const warnings = r.warnings.length
      ? r.warnings
          .map(
            (issue, i) =>
              `<article class="card fix-card"><span class="fix-number">${String(i + 1).padStart(2, "0")}</span><div><h3>${escapeHTML(issue.title)}</h3><p>${escapeHTML(issue.detail)}</p><button class="fix-action" data-open-scan>Retake photo ↗</button></div><span class="severity ${issue.severity === "Medium" ? "medium" : ""}">${escapeHTML(issue.severity)} capture priority</span></article>`,
          )
          .join("")
      : '<article class="card"><h3>Capture checks passed.</h3><p class="muted small" style="margin-top:10px">No lighting, pose, size, blur, or expression threshold was triggered. This does not identify skin or anatomical imperfections.</p></article>';
    $("#analysis-content").innerHTML =
      `<div class="analysis-top"><article class="card analysis-photo">${photoMarkup(scan.photo, "Your analyzed photo")}${scan.photo ? landmarkOverlay(r) : ""}<span class="pill photo-badge">${r.landmarkCount} REAL LANDMARKS</span></article><article class="card score-card"><div class="card-label">Resting Face Score ${icon("face")}</div>${scoreGauge(r.resting, "resting", "Subjective AI appearance estimate")}<div class="score-caption">${r.ai ? "Subjective AI estimate" : "Not scored"}</div><p class="muted small">${r.ai ? "Vision model · running on your device" : "Choose Browser AI when rescanning"}</p></article><article class="card score-card potential-card"><div class="card-label">Potential Score ${icon("spark")}</div>${scoreGauge(r.potential, "potential", "AI presentation potential estimate")}<div class="score-caption green">${r.ai ? "AI presentation estimate" : "Not scored"}</div><p class="muted small">Grooming & styling scenario</p></article></div><article class="card model-card"><span class="badge">${r.ai ? "REAL BROWSER AI · NO API" : "AI ENGINE STATUS"}</span><h3>${r.ai ? "The model’s assessment" : "Measurements available"}</h3>${r.ai ? '<p class="muted small">' + escapeHTML(r.ai.model) + " · " + escapeHTML(r.ai.rubric) + (r.aiCached ? " · reused for this identical photo" : "") + "</p>" : ""}<p>${escapeHTML(r.ai?.summary || r.aiError || "This scan contains measured landmarks only. Rescan with Browser AI to request an appearance estimate.")}</p><p class="muted small">${r.ai ? "This is a general vision-language model. These are subjective generated opinions, not a validated attractiveness benchmark. Potential describes a grooming scenario, not a measured future result." : "No numeric AI rating is substituted when inference is unavailable or its output is invalid."}</p>${r.ai || r.aiRaw ? '<details class="model-output"><summary>Inspect actual model output ↗</summary><pre>' + escapeHTML(r.ai?.raw || r.aiRaw) + "</pre></details>" : ""}</article><div class="measurement-method card"><div><span class="badge">SEPARATE GEOMETRY ANALYSIS</span><h3>Measured points. Visible proportions.</h3><p>${escapeHTML(r.formula)} Geometry summary: ${r.geometry ?? "withheld"}${r.geometry === null ? "" : "/100"}. Geometry does not generate the AI rating.</p></div><button class="text-button green" data-article="simulation">How the engines work ↗</button></div><div class="section-heading"><h2>Measured facial features</h2><span class="badge">${r.confidence}% CAPTURE CONFIDENCE</span></div><div class="metric-grid">${r.metrics.map((m) => `<article class="card metric-card"><div class="metric-title">${escapeHTML(m.name)}${icon(m.id === "skin" ? "droplet" : "face")}</div><div class="metric-value">${m.raw ?? "—"}<small>${escapeHTML(m.unit)}</small></div><div class="metric-bar"><span style="width:${m.value ?? 0}%"></span></div><div class="metric-note">${escapeHTML(m.note)}${m.value !== null ? "<br>Reference-band index: " + m.value + "/100" : ""}</div></article>`).join("")}</div><div class="section-heading"><h2>What You Need to Fix</h2><span class="badge">${r.ai ? "AI SUGGESTIONS + CAPTURE CHECKS" : "CAPTURE CHECKS"}</span></div><div class="fix-list">${(r.ai?.issues || []).map((issue, i) => '<article class="card fix-card"><span class="fix-number">' + String(i + 1).padStart(2, "0") + '</span><div><div class="ai-fix-label">AI VISUAL OBSERVATION</div><h3>' + escapeHTML(issue.issue) + "</h3><p>" + escapeHTML(issue.action) + '</p><button class="fix-action" data-add-plan="' + goalFor(issue) + '">Add related routine to plan +</button></div><span class="severity ' + (issue.severity === "Medium" ? "medium" : "") + '">' + escapeHTML(issue.severity) + " priority</span></article>").join("")}${warnings}</div><div class="section-heading"><h2>Choose your improvement goals</h2><span class="badge">OPTIONAL ROUTINES</span></div><div class="fix-list">${rankedFixes(
        r,
      )
        .map(
          (f, i) =>
            `<article class="card fix-card"><span class="fix-number">${String(i + 1).padStart(2, "0")}</span><div><h3>${f.title}</h3><p class="observation">Optional goal · not a detected imperfection</p><p>${f.action}</p><button class="fix-action" data-add-plan="${f.id}">${state.plan.includes(f.id) ? "In your action plan ✓" : "Add to action plan +"}</button><span class="muted small"> · </span><button class="fix-action" data-article="${f.article}">Read the guide ↗</button></div><span class="severity">Self-selected goal</span></article>`,
        )
        .join(
          "",
        )}</div><article class="card comparison-card"><div class="section-heading compact"><h2>Current vs Potential</h2><span class="badge">LIGHTING ONLY</span></div><p class="muted small">The same photo with an adjustable presentation filter. This does not predict a different face or treatment outcome.</p><div class="comparison-grid"><div class="comparison-frame"><span class="pill">CURRENT PHOTO</span>${photoMarkup(scan.photo, "Current photo")}</div><div class="comparison-frame potential-view" id="potential-image"><span class="pill">LIGHTING PREVIEW · NO PREDICTED SCORE</span>${photoMarkup(scan.photo, "Same photo with a lighting filter")}</div></div><div class="comparison-controls"><span>Same anatomy · no predicted outcome</span><label>Lighting intensity <input type="range" id="preview-intensity" min="0" max="100" value="60" aria-label="Potential preview lighting intensity"></label></div></article>`;
  }
  function goalFor(issue) {
    const text = (issue.issue + " " + issue.action).toLowerCase();
    if (/skin|acne|moisturi|cleanse|texture|spf/.test(text)) return "skin";
    if (/eyebrow|brow|glasses|eyewear|under.eye/.test(text)) return "eyes";
    if (/hair|beard|shav|groom/.test(text)) return "grooming";
    if (/jaw|chin|lower.face/.test(text)) return "jaw";
    return "photo";
  }
  function rankedFixes(r) {
    const priorities = [
      ...(r.ai?.issues || []).map(goalFor),
      ...(r.warnings?.length ? ["photo"] : []),
    ];
    return FIXES.slice().sort((a, b) => {
      const rank = (id) =>
        priorities.includes(id) ? priorities.indexOf(id) : 100;
      return rank(a.id) - rank(b.id);
    });
  }
  function comparableScans() {
    const latest = state.scans.findLast((s) => s.report?.ai)?.report.ai;
    return latest
      ? state.scans.filter(
          (s) =>
            s.report?.ai?.model === latest.model &&
            s.report.ai.revision === latest.revision &&
            s.report.ai.rubric === latest.rubric,
        )
      : [];
  }
  function renderProgress() {
    const root = $("#progress-content"),
      measured = state.scans.filter((s) => s.report),
      scored = comparableScans();
    if (!state.scans.length) {
      root.innerHTML = `<div class="empty-state">${icon("chart")}<h2>Every journey has a first frame.</h2><p>Record a real landmark scan to start your photo timeline.</p><button class="button button-green" data-open-scan>Record your first scan ↗</button></div>`;
      return;
    }
    const first = scored[0]?.report.resting,
      last = scored.at(-1)?.report.resting,
      delta = last !== undefined ? last - first : null;
    root.innerHTML = `<div class="history-stats"><article class="card"><h3>Measured scans</h3><strong>${measured.length}</strong></article><article class="card"><h3>Latest AI estimate</h3><strong>${last ?? "—"}</strong></article><article class="card"><h3>Estimate change</h3><strong class="green">${delta === null ? "—" : (delta > 0 ? "+" : "") + delta}</strong></article></div><article class="card chart-card"><div class="section-heading compact"><h2>AI score history</h2><span class="badge">SUBJECTIVE AI ESTIMATES</span></div><div class="chart-wrap">${renderChart()}</div><p class="muted small" style="margin-top:14px">Scores are the model’s subjective appearance estimates. Pose, expression, grooming and model limitations can affect them. The chart compares the latest model, revision and rubric only. Green: current; orange dashed: potential. Geometry-only and legacy simulated scans are excluded.</p></article><div class="section-heading"><h2>Your photo timeline</h2><span class="muted small">Latest first · up to ${MAX_PHOTOS} scans</span></div><div class="timeline">${state.scans
      .slice()
      .reverse()
      .map(
        (s) =>
          `<article class="card timeline-item">${photoMarkup(s.photo, "Progress photo from " + formatDate(s.date))}<div class="timeline-meta"><span>${formatDate(s.date, { year: "numeric" })}<br><span class="muted">${s.report?.ai ? "Browser AI estimate" : s.report ? "Measured landmarks only" : "Legacy simulation · rescan"}</span></span><strong>${s.report?.resting ?? "—"}</strong></div>${s.photo ? '<button class="timeline-delete" data-rescan="' + s.id + '">Rescan this photo ↗</button>' : ""}<button class="timeline-delete" data-delete-scan="${s.id}" aria-label="Delete scan from ${formatDate(s.date)}">Remove this scan ×</button></article>`,
      )
      .join("")}</div>`;
  }
  function renderChart() {
    const scans = comparableScans();
    if (!scans.length)
      return '<div class="empty-state" style="padding:35px"><p>No measured scores yet. Rescan a saved photo or record a new scan.</p></div>';
    const w = 800,
      h = 220,
      pad = 35,
      x = (i) =>
        scans.length === 1
          ? w / 2
          : pad + (i * (w - pad * 2)) / (scans.length - 1),
      y = (score) => h - pad - (score * (h - pad * 2)) / 100;
    let svg = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="AI appearance estimate history"><title>${scans.map((s) => formatDate(s.date) + ": " + s.report.resting).join("; ")}</title>`;
    [0, 25, 50, 75, 100].forEach((v) => {
      svg += `<line x1="${pad}" y1="${y(v)}" x2="${w - pad}" y2="${y(v)}" stroke="#2a3626" stroke-dasharray="3 5"/><text x="12" y="${y(v) + 3}" fill="#7c9271" font-size="9">${v}</text>`;
    });
    svg += `<polyline points="${scans.map((s, i) => x(i) + "," + y(s.report.resting)).join(" ")}" fill="none" stroke="#c1f4a4" stroke-width="2"/>`;
    svg += `<polyline points="${scans.map((s, i) => x(i) + "," + y(s.report.potential)).join(" ")}" fill="none" stroke="#e7bb83" stroke-width="2" stroke-dasharray="5 4"/>`;
    scans.forEach((s, i) => {
      svg += `<circle cx="${x(i)}" cy="${y(s.report.resting)}" r="4" fill="#c1f4a4"><title>${s.report.resting}</title></circle>`;
      svg += `<circle cx="${x(i)}" cy="${y(s.report.potential)}" r="3" fill="#e7bb83"><title>Potential ${s.report.potential}</title></circle>`;
    });
    return svg + "</svg>";
  }

  function renderPlan() {
    const done = state.plan.filter((id) => state.completed.includes(id)).length;
    $("#plan-count").textContent = state.plan.length - done;
    $("#plan-status").textContent = `${done} of ${state.plan.length} completed`;
    $("#plan-content").innerHTML = state.plan.length
      ? state.plan
          .map((id, i) => {
            const f = FIXES.find((f) => f.id === id),
              completed = state.completed.includes(id);
            const issue = currentReport().ai?.issues.find(
              (issue) => goalFor(issue) === id,
            );
            const title = escapeHTML(issue?.issue || f.title),
              action = escapeHTML(issue?.action || f.action);
            return `<article class="card plan-card ${completed ? "done" : ""}"><button class="habit-check ${completed ? "checked" : ""}" data-toggle-plan="${id}" aria-pressed="${completed}" aria-label="${completed ? "Mark incomplete" : "Complete"}: ${title}">${completed ? "✓" : ""}</button><div><h3>${title}</h3><p>${action}</p><div class="plan-meta"><span>${issue ? "AI SUGGESTION" : f.category}</span><span>${f.time}</span><button class="text-button green" data-add-habit="${id}">Add daily habit +</button><button class="text-button" data-remove-plan="${id}">Remove ×</button></div></div><span class="plan-priority">Priority ${String(i + 1).padStart(2, "0")}</span></article>`;
          })
          .join("")
      : `<div class="empty-state">${icon("check")}<h2>A clear canvas.</h2><p>Choose the priorities that matter to you from your face report.</p><a href="#scan" class="button button-green">Explore the report ↗</a></div>`;
  }
  const isChecked = (id) => (state.checks[dateKey()] || []).includes(id);
  function habitRow(h, allowDelete = false) {
    const done = isChecked(h.id);
    return `<div class="habit-row ${done ? "done" : ""}"><button class="habit-check ${done ? "checked" : ""}" data-habit="${h.id}" aria-label="${done ? "Uncheck" : "Complete"}: ${escapeHTML(h.name)}" aria-pressed="${done}">${done ? "✓" : ""}</button><span class="habit-text">${escapeHTML(h.name)}</span><span class="habit-category">${escapeHTML(h.category)}</span>${allowDelete ? `<button class="delete-habit" data-delete-habit="${h.id}" aria-label="Delete habit: ${escapeHTML(h.name)}">×</button>` : ""}</div>`;
  }
  function renderHabits() {
    $("#overview-habits").innerHTML = state.habits.length
      ? state.habits
          .slice(0, 3)
          .map((h) => habitRow(h))
          .join("")
      : '<p class="muted small">Add your first habit in Daily routine.</p>';
    $("#all-habits").innerHTML = state.habits.length
      ? state.habits.map((h) => habitRow(h, true)).join("")
      : '<p class="muted small">Your first daily commitment starts below.</p>';
    const done = state.habits.filter((h) => isChecked(h.id)).length;
    $("#routine-summary").textContent =
      `${done} of ${state.habits.length} completed today`;
    $("#routine-percent").textContent =
      `${state.habits.length ? Math.round((done / state.habits.length) * 100) : 0}%`;
    $("#routine-date").textContent = formatDate(new Date(), {
      weekday: "long",
    });
    $("#checkin-total").textContent = Object.values(state.checks).reduce(
      (n, ids) => n + ids.length,
      0,
    );
    const now = new Date(),
      start = new Date(now);
    start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    $("#week-strip").innerHTML = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const key = dateKey(date),
        today = key === dateKey();
      return `<div class="day ${today ? "today" : ""} ${state.checks[key]?.length ? "has-checkin" : ""}" ${today ? 'aria-current="date"' : ""}><span>${new Intl.DateTimeFormat("en", { weekday: "short" }).format(date)}</span><strong>${date.getDate()}</strong></div>`;
    }).join("");
  }
  function renderStyle() {
    const styles = {
      minimal: [
        [
          "Clean lines",
          "Ask for a clean, softly tapered haircut with manageable volume. Keep the neckline tidy.",
        ],
        [
          "A quieter palette",
          "Build around black, off-white, and olive. Focus on shoulder fit and clean hems.",
        ],
        [
          "The daily edit",
          "A simple skincare routine, tidy brows, and one small accessory make a considered finish.",
        ],
      ],
      textured: [
        [
          "Natural movement",
          "Ask for a textured cut that works with your natural hair pattern. Try a light styling cream.",
        ],
        [
          "Relaxed proportions",
          "Pair a relaxed overshirt with a straight-leg trouser. Try a neutral base and a warm accent.",
        ],
        [
          "An easy finish",
          "Keep facial-hair edges tidy and let your hair texture carry the look. Test a matte finish.",
        ],
      ],
      classic: [
        [
          "A defined silhouette",
          "Try a side part or a softly structured cut. Bring your barber front and side references.",
        ],
        [
          "Fit with intention",
          "Try a tailored jacket with a simple shirt. Check sleeve length and trouser break before buying.",
        ],
        [
          "Details, considered",
          "Match the tones of glasses, a watch, and other accessories. Keep grooming regular and simple.",
        ],
      ],
    };
    $("#style-goal").value = state.profile.style;
    $("#style-content").innerHTML = styles[state.profile.style]
      .map(
        ([title, desc], i) =>
          `<article class="card style-card"><div class="style-visual">${icon(["scissors", "shirt", "spark"][i])}</div><div class="style-details"><span class="library-category">${["HAIR & FRAMING", "WARDROBE", "GROOMING"][i]}</span><h3 style="margin-top:10px">${title}</h3><p>${desc}</p><button class="text-button green" data-article="${i === 0 ? "hair" : i === 1 ? "style" : "skin"}">Explore the guide ↗</button></div></article>`,
      )
      .join("");
  }
  function renderLibrary() {
    const visible = ARTICLES.filter(
      (a) =>
        (filter === "all" || a.category === filter) &&
        `${a.title} ${a.desc} ${a.body}`.toLowerCase().includes(search),
    );
    $("#library-content").innerHTML = visible.length
      ? visible
          .map(
            (a) =>
              `<button class="card library-card" data-article="${a.id}"><div class="article-art ${a.category}">${icon(a.icon)}</div><div class="library-details"><span class="library-category">${a.category} / FIELD NOTES</span><h3>${a.title}</h3><p>${a.desc}</p></div><div class="library-bottom"><span>${a.time} read</span><span>Read guide ↗</span></div></button>`,
          )
          .join("")
      : `<div class="empty-state" style="grid-column:1/-1"><h2>No guides found.</h2><p>Try another search or choose a different category.</p><button class="button button-outline" id="reset-library">Reset filters</button></div>`;
  }
  function renderProfile() {
    const name = state.profile.name.trim();
    $("#profile-name").textContent = name || "Your workspace";
    const initial = name ? Array.from(name)[0].toUpperCase() : "Y";
    $("#avatar").textContent = initial;
    $(".top-avatar").textContent = initial;
    $("#greeting").textContent = name
      ? `WELCOME BACK, ${name.toUpperCase()}`
      : "YOUR PERSONAL EVOLUTION";
    $("#display-name").value = name;
    $("#goal-select").value = state.profile.goal;
    $("#save-photos").checked = state.profile.savePhotos;
    $("#reduce-motion").checked = state.profile.reduceMotion;
    document.body.classList.toggle("reduce-motion", state.profile.reduceMotion);
  }
  function renderAll() {
    renderProfile();
    renderOverview();
    renderAnalysis();
    renderProgress();
    renderPlan();
    renderStyle();
    renderLibrary();
  }
  const routeNames = {
    overview: "Overview",
    scan: "Face analysis",
    progress: "My progress",
    plan: "Action plan",
    routine: "Daily routine",
    body: "Body analysis",
    style: "Style & grooming",
    library: "The library",
    settings: "Settings",
  };
  function route() {
    const requested = location.hash.slice(1) || "overview",
      next = Object.hasOwn(routeNames, requested) ? requested : "overview";
    $$(".page").forEach((page) => {
      const active = page.id === `page-${next}`;
      page.hidden = !active;
      page.classList.toggle("active", active);
    });
    $$("[data-nav]").forEach((a) => {
      const active = a.dataset.nav === next;
      a.classList.toggle("active", active);
      if (active) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    $("#breadcrumb").textContent = routeNames[next];
    document.title = `${routeNames[next]} — Ascend`;
    closeMenu();
    if (activeRoute && activeRoute !== next) {
      window.scrollTo({ top: 0, behavior: "instant" });
      $("#main").focus({ preventScroll: true });
    }
    activeRoute = next;
  }
  function navigate(next) {
    if (location.hash === `#${next}`) route();
    else location.hash = next;
  }
  function closeMenu() {
    $("#sidebar").classList.remove("open");
    $("#sidebar").inert = matchMedia("(max-width:700px)").matches;
    $("#menu-toggle").setAttribute("aria-expanded", "false");
    $("#menu-toggle").setAttribute("aria-label", "Open navigation");
  }
  function openArticle(id) {
    const article = ARTICLES.find((a) => a.id === id);
    if (!article) return;
    $("#article-category").textContent =
      `THE LIBRARY / ${article.category.toUpperCase()}`;
    $("#article-body").innerHTML =
      `<h2 id="article-title">${article.title}</h2>${article.body}<button class="button button-green" data-close-dialog>Back to your workspace ↗</button>`;
    $("#article-dialog").showModal();
    $("#article-dialog").scrollTop = 0;
  }

  // Image handling: decode, downsample, and discard original file metadata.
  async function processImage(file) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
      throw new Error("Choose a JPG, PNG, or WebP image.");
    if (!file.size || file.size > 12 * 1024 * 1024)
      throw new Error("Choose a photo smaller than 12 MB.");
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (image.width < 120 || image.height < 120)
        throw new Error("Use a photo at least 120 × 120 pixels.");
      const scale = Math.min(1, 640 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.fillStyle = "#1a2118";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.78);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function stopCamera() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    $("#camera-video").srcObject = null;
  }
  function setScanMode(camera) {
    $("#upload-mode").classList.toggle("active", !camera);
    $("#camera-mode").classList.toggle("active", camera);
    $("#upload-mode").setAttribute("aria-pressed", String(!camera));
    $("#camera-mode").setAttribute("aria-pressed", String(camera));
    $("#camera-view").hidden = !camera;
    $("#drop-zone").hidden = camera || Boolean(selectedPhoto);
    $("#photo-preview").hidden = camera || !selectedPhoto;
  }
  function openScan() {
    runId++;
    selectedPhoto = null;
    $("#photo-input").value = "";
    $("#scan-error").textContent = "";
    $("#scan-loading").hidden = true;
    $("#analyze-button").disabled = true;
    $("#analyze-button").innerHTML = "Analyze my face <span>↗</span>";
    $("#upload-mode").disabled = false;
    $("#camera-mode").disabled = false;
    $("#scan-preview").removeAttribute("src");
    stopCamera();
    setScanMode(false);
    scanDialog.showModal();
  }
  async function choosePhoto(file) {
    if (!file) return;
    const token = ++runId;
    $("#scan-error").textContent = "";
    $("#analyze-button").disabled = true;
    try {
      const photo = await processImage(file);
      if (token !== runId || !scanDialog.open) return;
      selectedPhoto = photo;
      $("#scan-preview").src = photo;
      stopCamera();
      setScanMode(false);
      $("#analyze-button").disabled = false;
    } catch (error) {
      if (token === runId) {
        $("#scan-error").textContent =
          error.message || "This image could not be opened. Try another photo.";
        $("#analyze-button").disabled = !selectedPhoto;
      }
    }
  }
  async function startCamera() {
    const token = ++runId;
    stopCamera();
    setScanMode(true);
    $("#scan-error").textContent = "";
    $("#analyze-button").disabled = true;
    if (!navigator.mediaDevices?.getUserMedia) {
      $("#scan-error").textContent =
        "Webcam access needs HTTPS or localhost. You can upload a photo instead.";
      setScanMode(false);
      $("#analyze-button").disabled = !selectedPhoto;
      return;
    }
    try {
      const camera = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 900 },
          height: { ideal: 900 },
        },
        audio: false,
      });
      if (token !== runId || !scanDialog.open) {
        camera.getTracks().forEach((t) => t.stop());
        return;
      }
      stream = camera;
      $("#camera-video").srcObject = stream;
      await $("#camera-video").play();
    } catch (error) {
      if (token !== runId) return;
      stopCamera();
      setScanMode(false);
      $("#analyze-button").disabled = !selectedPhoto;
      $("#scan-error").textContent =
        error.name === "NotAllowedError"
          ? "Camera permission was not granted. Allow it in your browser or upload a photo."
          : "No camera is available. Connect a webcam or upload a photo.";
    }
  }
  function capturePhoto() {
    const video = $("#camera-video");
    if (!video.videoWidth) {
      $("#scan-error").textContent =
        "The camera is still starting. Try again in a moment.";
      return;
    }
    const canvas = document.createElement("canvas");
    const scale = Math.min(
      1,
      640 / Math.max(video.videoWidth, video.videoHeight),
    );
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    selectedPhoto = canvas.toDataURL("image/jpeg", 0.78);
    $("#scan-preview").src = selectedPhoto;
    stopCamera();
    setScanMode(false);
    $("#analyze-button").disabled = false;
    $("#scan-error").textContent = "";
  }
  let activeInference = null;
  let ratingWorker = null,
    ratingMode = null,
    modelIdleTimer;
  function unloadRatingModel() {
    clearTimeout(modelIdleTimer);
    ratingWorker?.terminate();
    ratingWorker = null;
  }
  function runWorker(
    worker,
    payload,
    transfer,
    token,
    maxTime,
    mapProgress = (p) => p,
  ) {
    return new Promise((resolve, reject) => {
      let lastPercent = 0,
        settled = false;
      const timer = setTimeout(
        () =>
          reject(
            new Error(
              "Model loading or inference timed out. Check the connection or choose measurements only.",
            ),
          ),
        maxTime,
      );
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        activeInference = null;
        fn(value);
      };
      activeInference = { worker, reject: (error) => finish(reject, error) };
      worker.onmessage = ({ data }) => {
        if (data.id !== token || token !== runId) return;
        if (data.type === "progress") {
          const percent = Math.max(
            lastPercent,
            Math.round(mapProgress(data.percent)),
          );
          lastPercent = percent;
          $("#scan-bar").style.width = percent + "%";
          $("#scan-percent").textContent = percent + "%";
          $("#scan-stage").textContent = data.stage;
        }
        if (data.type === "result") finish(resolve, data);
        if (data.type === "error") {
          const error = new Error(data.message);
          error.raw = data.raw;
          finish(reject, error);
        }
      };
      worker.onerror = (error) =>
        finish(
          reject,
          new Error(
            "The browser inference engine could not load. " +
              (error.message || "Check the model CDN connection."),
          ),
        );
      worker.postMessage({ ...payload, id: token }, transfer);
    });
  }
  async function faceCrop(photo, report) {
    const bitmap = await createImageBitmap(await (await fetch(photo)).blob());
    const points = report.points;
    const xs = points.map((p) => p[0] * bitmap.width),
      ys = points.map((p) => p[1] * bitmap.height);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs),
      minY = Math.min(...ys),
      maxY = Math.max(...ys);
    const fw = maxX - minX,
      fh = maxY - minY;
    const x = Math.max(0, minX - fw * 0.2),
      y = Math.max(0, minY - fh * 0.4);
    const width = Math.min(bitmap.width - x, maxX + fw * 0.2 - x),
      height = Math.min(bitmap.height - y, maxY + fh * 0.12 - y);
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 512 / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    canvas
      .getContext("2d")
      .drawImage(
        bitmap,
        x,
        y,
        width,
        height,
        0,
        0,
        canvas.width,
        canvas.height,
      );
    bitmap.close();
    return new Promise((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error("Face crop could not be prepared.")),
        "image/png",
      ),
    );
  }
  async function analyzePhoto() {
    if (!selectedPhoto) return;
    const token = ++runId,
      photo = selectedPhoto;
    stopCamera();
    $("#analyze-button").disabled = true;
    $("#upload-mode").disabled = true;
    $("#camera-mode").disabled = true;
    $("#change-photo").disabled = true;
    const mode = $("#analysis-mode").value;
    const withAI = mode !== "measure";
    $("#analysis-mode").disabled = true;
    $("#analyze-button").textContent = "Measuring your face…";
    $("#scan-loading").hidden = false;
    $("#scan-error").textContent = "";
    $("#scan-bar").style.width = "2%";
    $("#scan-percent").textContent = "2%";
    $("#scan-stage").textContent = "Decoding your photo";
    let worker, timeout;
    try {
      if (location.protocol === "file:")
        throw new Error(
          "Real face analysis requires HTTPS or localhost. Open the deployed site or run the local server.",
        );
      const bitmap = await createImageBitmap(await (await fetch(photo)).blob());
      if (token !== runId || !scanDialog.open) {
        bitmap.close();
        return;
      }
      worker = new Worker(new URL("face-worker.js?v=ai-20261019-3", document.baseURI));
      let report = sanitizeReport(
        (
          await runWorker(worker, { bitmap }, [bitmap], token, 90000, (p) =>
            withAI ? 2 + p * 0.16 : p,
          )
        ).report,
      );
      worker.terminate();
      if (token !== runId || !scanDialog.open) return;
      if (!report)
        throw new Error("The measurement report was invalid. Please retry.");
      if (withAI) {
        try {
          if (Math.abs(report.yaw) > 30 || report.confidence < 45)
            throw new Error(
              "Retake a clear frontal portrait before AI scoring. The capture confidence is too low.",
            );
          // Fingerprints are cache lookups only; their bits never become ratings.
          const digest = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(
              "Qwen-Smol-pinned-v3:" +
                mode +
                ":" +
                AscendRating.RUBRIC +
                ":" +
                photo,
            ),
          );
          const cacheKey = [...new Uint8Array(digest)]
            .map((v) => v.toString(16).padStart(2, "0"))
            .join("");
          const cached = state.scans.findLast(
            (s) =>
              s.report?.cacheKey === cacheKey &&
              s.report.ai?.rubric === AscendRating.RUBRIC,
          )?.report.ai;
          if (cached) {
            report = sanitizeReport({
              ...report,
              ai: cached,
              cacheKey,
              aiCached: true,
            });
          } else {
            clearTimeout(modelIdleTimer);
            if (ratingMode !== mode) unloadRatingModel();
            ratingMode = mode;
            ratingWorker ||= new Worker(
              new URL("rating-worker.js?v=ai-20261019-3", document.baseURI),
              { type: "module" },
            );
            const croppedPhoto = await faceCrop(photo, report);
            if (token !== runId || !scanDialog.open) {
              unloadRatingModel();
              return;
            }
            const result = await runWorker(
              ratingWorker,
              { photo: croppedPhoto, mode },
              [],
              token,
              600000,
            );
            report = sanitizeReport({ ...report, ai: result.rating, cacheKey });
            modelIdleTimer = setTimeout(unloadRatingModel, 120000);
          }
        } catch (error) {
          unloadRatingModel();
          if (token !== runId || !scanDialog.open) return;
          report = sanitizeReport({
            ...report,
            aiError: error.message,
            aiRaw: error.raw,
          });
        }
      }
      if (token !== runId || !scanDialog.open) return;
      const scan = {
        id: "scan-" + Date.now(),
        date: new Date().toISOString(),
        seed: null,
        report,
        photo: state.profile.savePhotos ? photo : null,
      };
      if (!state.scans.some((s) => s.report)) {
        state.plan = rankedFixes(report)
          .slice(0, 3)
          .map((f) => f.id);
        state.completed = [];
      }
      state.scans.push(scan);
      state.scans = state.scans.slice(-MAX_PHOTOS);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        scan.photo = null;
        saveState();
      }
      $("#scan-bar").style.width = "100%";
      $("#scan-percent").textContent = "100%";
      activeInference = null;
      renderAll();
      scanDialog.close();
      navigate("scan");
      toast(
        report.ai
          ? "Your on-device AI report is ready."
          : report.aiError
            ? "Landmarks saved. AI could not score this scan — see report."
            : "Your measured report is ready.",
      );
    } catch (error) {
      if (token === runId && scanDialog.open) {
        $("#scan-error").textContent =
          error.message || "Face analysis failed. Please retry.";
        $("#analyze-button").disabled = false;
        $("#analyze-button").textContent = "Retry face analysis";
        $("#scan-loading").hidden = true;
      }
    } finally {
      clearTimeout(timeout);
      worker?.terminate();
      activeInference = null;
      $("#upload-mode").disabled = false;
      $("#camera-mode").disabled = false;
      $("#change-photo").disabled = false;
      $("#analysis-mode").disabled = false;
    }
  }

  // Lightweight 3D facial wireframe: an original, procedural canvas asset.
  function initFaceArt() {
    const canvas = $("#face-art"),
      ctx = canvas.getContext("2d");
    if (!ctx) return;
    let width = 0,
      height = 0,
      frame = 0,
      visible = true;
    const reduced = () =>
      state.profile.reduceMotion ||
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    function resize() {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }
    const rows = 31,
      cols = 30;
    function point(i, j, t) {
      const v = i / rows,
        phi = (j / cols) * Math.PI * 2,
        yy = (v - 0.5) * 2;
      const outline =
        Math.pow(Math.max(0, 1 - yy * yy), 0.44) * (1 - 0.34 * Math.max(0, yy));
      let x = Math.sin(phi) * outline * 0.66,
        y = yy,
        z = Math.cos(phi) * outline * 0.53;
      if (Math.cos(phi) > 0) {
        // Nose bridge, brow ridge, eye sockets, lips, cheekbones, and chin.
        const bump = (cx, cy, sx, sy, amount) =>
          amount * Math.exp(-((x - cx) ** 2 / sx + (y - cy) ** 2 / sy));
        z +=
          bump(0, -0.02, 0.01, 0.13, 0.36) + bump(0, 0.16, 0.025, 0.012, 0.21);
        z -=
          bump(-0.25, -0.17, 0.018, 0.014, 0.2) +
          bump(0.25, -0.17, 0.018, 0.014, 0.2);
        z +=
          bump(-0.26, -0.29, 0.032, 0.009, 0.09) +
          bump(0.26, -0.29, 0.032, 0.009, 0.09);
        z +=
          bump(-0.4, 0.08, 0.025, 0.08, 0.09) +
          bump(0.4, 0.08, 0.025, 0.08, 0.09);
        z +=
          bump(0, 0.42, 0.06, 0.009, 0.09) -
          bump(0, 0.46, 0.05, 0.003, 0.035) +
          bump(0, 0.72, 0.07, 0.025, 0.08);
      }
      const angle = -0.48 + Math.sin(t * 0.00022) * 0.07,
        rx = x * Math.cos(angle) + z * Math.sin(angle),
        rz = -x * Math.sin(angle) + z * Math.cos(angle);
      const tilt = -0.06,
        ry = y * Math.cos(tilt) - rz * Math.sin(tilt),
        zz = y * Math.sin(tilt) + rz * Math.cos(tilt);
      const scale = Math.min(width * 0.42, height * 0.41),
        perspective = 1 + zz * 0.11;
      return {
        x: width * 0.51 + rx * scale * perspective,
        y: height * 0.48 + ry * scale * perspective,
        z: zz,
        vx: rx,
        vy: ry,
      };
    }
    function draw(t = 0) {
      if (!width || !height) return;
      ctx.clearRect(0, 0, width, height);
      const points = Array.from({ length: rows + 1 }, (_, i) =>
        Array.from({ length: cols + 1 }, (_, j) => point(i, j, t)),
      );
      const faces = [];
      for (let i = 0; i < rows; i++)
        for (let j = 0; j < cols; j++) {
          const a = points[i][j],
            b = points[i + 1][j],
            c = points[i][j + 1],
            d = points[i + 1][j + 1];
          faces.push([a, b, c], [b, d, c]);
        }
      faces.sort(
        (a, b) =>
          a.reduce((s, p) => s + p.z, 0) - b.reduce((s, p) => s + p.z, 0),
      );
      faces.forEach((tri, index) => {
        const depth = tri.reduce((s, p) => s + p.z, 0) / 3,
          alpha = Math.max(0.08, 0.22 + depth * 0.38);
        const [a, b, c] = tri,
          ux = b.vx - a.vx,
          uy = b.vy - a.vy,
          uz = b.z - a.z,
          vx = c.vx - a.vx,
          vy = c.vy - a.vy,
          vz = c.z - a.z;
        let nx = uy * vz - uz * vy,
          ny = uz * vx - ux * vz,
          nz = ux * vy - uy * vx;
        if (nz < 0) {
          nx = -nx;
          ny = -ny;
          nz = -nz;
        }
        const length = Math.hypot(nx, ny, nz) || 1;
        const light = Math.max(0, (-nx * 0.5 - ny * 0.6 + nz * 0.7) / length),
          tone = depth > 0 ? light : light * 0.25;
        ctx.beginPath();
        tri.forEach((p, i) =>
          i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
        );
        ctx.closePath();
        ctx.fillStyle = `rgb(${Math.round(22 + tone * 29)},${Math.round(34 + tone * 37)},${Math.round(21 + tone * 22)})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(171,207,139,${alpha})`;
        ctx.lineWidth = 0.45;
        ctx.stroke();
        if (index % 13 === 0 && depth > 0.15) {
          ctx.beginPath();
          ctx.arc(tri[0].x, tri[0].y, 0.85, 0, Math.PI * 2);
          ctx.fillStyle = "#b4d994";
          ctx.fill();
        }
      });
      // Neck and shoulder contour in the same mapping language.
      const s = Math.min(width * 0.42, height * 0.41),
        cx = width * 0.51,
        base = height * 0.48;
      ctx.strokeStyle = "#92b47640";
      ctx.lineWidth = 0.6;
      for (let k = 0; k < 6; k++) {
        const y = base + s * (0.94 + k * 0.055),
          w = s * (0.18 + k * 0.1);
        ctx.beginPath();
        ctx.moveTo(cx - w, y + 10);
        ctx.quadraticCurveTo(cx, y - 15, cx + w, y + 10);
        ctx.stroke();
      }
    }
    let lastFrame = 0;
    function loop(t) {
      if (
        visible &&
        !document.hidden &&
        !reduced() &&
        activeRoute === "overview" &&
        t - lastFrame > 45
      ) {
        draw(t);
        lastFrame = t;
      }
      frame = requestAnimationFrame(loop);
    }
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
    }).observe(canvas);
    frame = requestAnimationFrame(loop);
    window.addEventListener("pagehide", () => cancelAnimationFrame(frame), {
      once: true,
    });
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `ascend-backup-${dateKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Your workspace backup is ready.");
  }
  async function importData(file) {
    if (!file) return;
    try {
      if (file.size > 12 * 1024 * 1024)
        throw new Error("Choose an Ascend backup smaller than 12 MB.");
      const imported = validateState(JSON.parse(await file.text()));
      state = imported;
      saveState();
      renderAll();
      toast("Your backup has been restored.");
    } catch (error) {
      toast(
        error instanceof SyntaxError
          ? "That file is not a valid JSON backup."
          : error.message || "This backup could not be imported.",
      );
    } finally {
      $("#import-data").value = "";
    }
  }

  // Delegated actions also cover content created after a new scan.
  document.addEventListener("click", (event) => {
    const el = event.target.closest("button,a");
    if (!el) return;
    if (el.hasAttribute("data-open-scan")) openScan();
    if (el.dataset.route) navigate(el.dataset.route);
    if (el.hasAttribute("data-close-dialog")) el.closest("dialog").close();
    if (el.dataset.article) openArticle(el.dataset.article);
    if (el.dataset.rescan) {
      const scan = state.scans.find((s) => s.id === el.dataset.rescan);
      if (scan?.photo) {
        openScan();
        selectedPhoto = scan.photo;
        $("#scan-preview").src = selectedPhoto;
        setScanMode(false);
        $("#analyze-button").disabled = false;
      }
    }
    if (el.dataset.habit) {
      const key = dateKey(),
        checks = state.checks[key] || [];
      state.checks[key] = checks.includes(el.dataset.habit)
        ? checks.filter((id) => id !== el.dataset.habit)
        : [...checks, el.dataset.habit];
      saveState();
      renderHabits();
    }
    if (el.dataset.deleteHabit) {
      state.habits = state.habits.filter(
        (h) => h.id !== el.dataset.deleteHabit,
      );
      saveState();
      renderHabits();
      toast("Habit removed.");
    }
    if (el.dataset.addPlan) {
      const id = el.dataset.addPlan;
      if (!state.plan.includes(id)) {
        state.plan.push(id);
        saveState();
        renderPlan();
        renderAnalysis();
        toast("Added to your action plan.");
      } else {
        navigate("plan");
      }
    }
    if (el.dataset.togglePlan) {
      const id = el.dataset.togglePlan;
      state.completed = state.completed.includes(id)
        ? state.completed.filter((i) => i !== id)
        : [...state.completed, id];
      saveState();
      renderPlan();
    }
    if (el.dataset.removePlan) {
      const id = el.dataset.removePlan;
      state.plan = state.plan.filter((i) => i !== id);
      state.completed = state.completed.filter((i) => i !== id);
      saveState();
      renderPlan();
      renderAnalysis();
    }
    if (el.dataset.addHabit) {
      const fix = FIXES.find((f) => f.id === el.dataset.addHabit);
      if (state.habits.some((h) => h.name === fix.habit.name)) {
        toast("This habit is already in your routine.");
        return;
      }
      if (state.habits.length >= 30) {
        toast("Your routine supports up to 30 habits.");
        return;
      }
      state.habits.push({ id: `habit-${Date.now()}`, ...fix.habit });
      saveState();
      renderHabits();
      toast("Added to your daily routine.");
    }
    if (el.dataset.deleteScan) {
      state.scans = state.scans.filter((s) => s.id !== el.dataset.deleteScan);
      saveState();
      renderAll();
      toast("Scan removed from your timeline.");
    }
    if (el.dataset.filter) {
      filter = el.dataset.filter;
      $$("[data-filter]").forEach((b) => {
        b.classList.toggle("active", b.dataset.filter === filter);
        b.setAttribute("aria-pressed", String(b.dataset.filter === filter));
      });
      renderLibrary();
    }
    if (el.id === "reset-library") {
      filter = "all";
      search = "";
      $("#library-search").value = "";
      $$("[data-filter]").forEach((b) => {
        b.classList.toggle("active", b.dataset.filter === "all");
        b.setAttribute("aria-pressed", String(b.dataset.filter === "all"));
      });
      renderLibrary();
    }
  });
  document.addEventListener("input", (event) => {
    if (event.target.id === "preview-intensity") {
      const amount = Number(event.target.value) / 100,
        img = $("#potential-image img");
      if (img)
        img.style.filter = `contrast(${1 + amount * 0.1}) brightness(${1 + amount * 0.1}) saturate(${1 - amount * 0.16})`;
    }
  });
  $("#explore-demo").addEventListener("click", () => openArticle("simulation"));
  $("#method-button").addEventListener("click", () =>
    openArticle("simulation"),
  );
  $("#help-button").addEventListener("click", () => openArticle("simulation"));
  $("#menu-toggle").addEventListener("click", () => {
    const open = $("#sidebar").classList.toggle("open");
    $("#sidebar").inert = !open && matchMedia("(max-width:700px)").matches;
    $("#menu-toggle").setAttribute("aria-expanded", String(open));
    $("#menu-toggle").setAttribute(
      "aria-label",
      open ? "Close navigation" : "Open navigation",
    );
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest("#sidebar,.mobile-header")) closeMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
    if (
      (event.key === "Enter" || event.key === " ") &&
      event.target.matches('label[role="button"]')
    ) {
      event.preventDefault();
      const input = event.target.htmlFor
        ? document.getElementById(event.target.htmlFor)
        : event.target.querySelector('input[type="file"]');
      input?.click();
    }
  });
  $(".skip-link").addEventListener("click", (event) => {
    event.preventDefault();
    $("#main").focus();
  });
  matchMedia("(max-width:700px)").addEventListener("change", closeMenu);
  $("#upload-mode").addEventListener("click", () => {
    runId++;
    stopCamera();
    setScanMode(false);
    $("#scan-error").textContent = "";
    $("#analyze-button").disabled = !selectedPhoto;
  });
  $("#camera-mode").addEventListener("click", startCamera);
  $("#photo-input").addEventListener("change", (event) => {
    choosePhoto(event.target.files[0]);
    event.target.value = "";
  });
  $("#change-photo").addEventListener("click", () => $("#photo-input").click());
  $("#capture-photo").addEventListener("click", capturePhoto);
  $("#analyze-button").addEventListener("click", analyzePhoto);
  scanDialog.addEventListener("close", () => {
    runId++;
    stopCamera();
    if (activeInference) {
      if (activeInference.worker === ratingWorker) ratingWorker = null;
      activeInference.worker.terminate();
      activeInference.reject(new Error("Scan cancelled"));
      activeInference = null;
    }
    $("#change-photo").disabled = false;
  });
  $$("#drop-zone").forEach((zone) => {
    ["dragenter", "dragover"].forEach((type) =>
      zone.addEventListener(type, (event) => {
        event.preventDefault();
        zone.classList.add("dragging");
      }),
    );
    ["dragleave", "drop"].forEach((type) =>
      zone.addEventListener(type, (event) => {
        event.preventDefault();
        zone.classList.remove("dragging");
      }),
    );
    zone.addEventListener("drop", (event) =>
      choosePhoto(event.dataTransfer.files[0]),
    );
  });
  $("#habit-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = $("#habit-name").value.trim();
    if (!name) return;
    if (state.habits.length >= 30) {
      toast("Your routine supports up to 30 habits.");
      return;
    }
    state.habits.push({
      id: `habit-${Date.now()}`,
      name: name.slice(0, 65),
      category: "PERSONAL",
    });
    saveState();
    $("#habit-name").value = "";
    renderHabits();
    toast("A new daily commitment.");
  });
  $("#style-goal").addEventListener("change", (event) => {
    state.profile.style = event.target.value;
    saveState();
    renderStyle();
  });
  $("#library-search").addEventListener("input", (event) => {
    search = event.target.value.toLowerCase().trim();
    renderLibrary();
  });
  $("#profile-form").addEventListener("submit", (event) => {
    event.preventDefault();
    state.profile = {
      ...state.profile,
      name: $("#display-name").value.trim().slice(0, 40),
      goal: $("#goal-select").value,
      savePhotos: $("#save-photos").checked,
      reduceMotion: $("#reduce-motion").checked,
    };
    if (!state.profile.savePhotos)
      state.scans.forEach((s) => {
        s.photo = null;
      });
    saveState();
    renderAll();
    toast("Your preferences are saved.");
  });
  $("#export-data").addEventListener("click", exportData);
  $("#import-data").addEventListener("change", (event) =>
    importData(event.target.files[0]),
  );
  $("#clear-data").addEventListener("click", () =>
    $("#confirm-dialog").showModal(),
  );
  $("#confirm-clear").addEventListener("click", () => {
    state = freshState();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    renderAll();
    $("#confirm-dialog").close();
    toast("Your local workspace has been cleared.");
  });
  // Native dialogs close with Escape; clicking the backdrop dismisses without action.
  $$("dialog").forEach((dialog) =>
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (
        event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom
      )
        dialog.close();
    }),
  );
  window.addEventListener("hashchange", route);
  window.addEventListener("pagehide", stopCamera);
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      restoreState();
      renderAll();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && lastDate !== dateKey()) {
      lastDate = dateKey();
      renderHabits();
    }
  });
  setInterval(() => {
    if (lastDate !== dateKey()) {
      lastDate = dateKey();
      renderHabits();
    }
  }, 30000);
  restoreState();
  hydrateIcons();
  renderAll();
  route();
  initFaceArt();
})();
