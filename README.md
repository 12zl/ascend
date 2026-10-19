# Ascend

A premium, responsive facial-analysis workspace made with HTML, CSS and JavaScript. The site runs on free GitHub Pages. AI runs in each visitor’s browser: **no API keys, subscriptions, inference server, or per-scan charges**.

- [Live website](https://12zl.github.io/ascend/)
- [GitHub repository](https://github.com/12zl/ascend)

## Real browser AI

The old file-hash simulation has been removed. Two independent engines process each photograph locally:

1. **MediaPipe Face Landmarker** detects 478 facial points and measures visible proportions, pose and capture quality.
2. **Qwen3-VL / SmolVLM** reads a crop around the detected face and generates a subjective current appearance rating, a grooming/presentation potential rating and visual suggestions. Transformers.js runs quantized ONNX weights through WebGPU in a separate Worker.

| Mode              | Model                                    |                  Weight download | Intended use                       |
| ----------------- | ---------------------------------------- | -------------------------------: | ---------------------------------- |
| Stronger AI       | onnx-community/Qwen3-VL-2B-Instruct-ONNX |                          1.37 GB | Devices with sufficient GPU memory |
| Fast AI           | HuggingFaceTB/SmolVLM-500M-Instruct      |                           390 MB | Smaller download, weaker reasoning |
| Measurements only | MediaPipe                                | Approximately 15 MB plus runtime | Lightweight landmark reports       |

The first use downloads public model files. Later uses can reuse the browser cache; browsers may evict cached files. A compatible WebGPU browser and adequate memory are required for AI. Measurements mode remains available when AI cannot run. Recent Chrome/Edge with hardware acceleration is a practical starting point. Performance depends on the device; there is no inference service to bill the owner or visitor. GitHub and model-download hosts retain their ordinary usage limits and availability policies.

**These are real generated model responses, not validated beauty predictions.** These are general vision-language models, not specialized attractiveness benchmarks. It can give poor, biased or repetitive opinions and may disagree with people. An actual model does not make attractiveness objective. Potential describes a grooming scenario, not a measured future face or promised score increase.

### How scores are obtained

The same face crop is queried three times: current rating, presentation potential, then grooming advice. Prompts are in `rating-worker.js`; decoding is greedy (`do_sample: false`). A score is displayed only if the response is a single valid integer from 1 to 100, optionally followed by `/100` or punctuation. Invalid output leaves the rating blank and preserves an inspectable failure report. No random, file-size, filename, image-hash or landmark-weight formula supplies a replacement number. Potential is not forced to be higher than the current score.

Reports expose the actual generated answers and model identifier. Only advice returned in the requested `issue | severity | action` format becomes an AI suggestion card. Other generated text is kept as the model’s comment rather than mislabeled as a concrete fix. Measured capture issues have separate severity ratings. Routine guides supply concrete skincare, grooming, eyewear and photo actions.

An identical processed photo, model mode and rubric can reuse a saved valid AI response. SHA-256 is used **only as a local cache lookup key**; its bits never generate ratings. New model/rubric versions should change the cache version in `app.js`. Clear scan history to remove saved results. Geometry-only scans and former simulated ratings are excluded from AI score history.

### Pinned models and runtime

- Transformers.js: `@huggingface/transformers@4.3.1`, bundled `dist/transformers.js`.
- Stronger model revision: `5dc9194ba42fa62c2f1440d98a71f7cd5280afe2`.
- Fast model revision: `a7da5b986cb59b408707209984f360a5f4ad7e47`.
- Qwen ONNX components: `embed_tokens_q4f16`, `vision_encoder_q4f16`, `decoder_model_merged_q4f16` plus external data files. SmolVLM uses `embed_tokens_fp16`, `vision_encoder_q4`, `decoder_model_merged_q4`.
- MediaPipe runtime: `@mediapipe/tasks-vision@1.1.1`; official float16 Face Landmarker v1.
- Qwen3-VL/SmolVLM weights and the listed runtimes are published under Apache-2.0; see their upstream license notices. Model weights are downloaded from upstream and are not included in this repository.

## Files

```text
ascend/
├── index.html        # App shell, navigation, upload/webcam dialog
├── styles.css        # Responsive premium dark theme
├── app.js            # UI, local data, worker coordination, crop and cache
├── analysis-core.js  # Pure landmark geometry and capture checks
├── face-worker.js    # MediaPipe inference worker
├── rating-core.js    # Strict model-response validation
├── rating-worker.js  # Actual local vision-language model inference
└── README.md
```

Keep all eight files together. No build step is required. App, stylesheet and worker URLs carry a release query to prevent mixed old/new browser caches. Bump the release query across these files when publishing future runtime changes. Relative worker paths work under a GitHub Pages repository subpath.

## Included features

- Landing section with an original animated canvas facial mesh and Start Face Scan action.
- Upload, drag-and-drop, image validation, webcam preview/capture, loading progress and cancellation.
- Current and potential AI score gauges, generated observations, severity and concrete action cards.
- Real landmark overlay and six measured facial proportions; skin/hairline are not numerically measured by the landmark engine.
- “What You Need to Fix,” related routine selection and a prioritized action plan.
- Current vs Potential comparison: adjustable lighting on the same photo, clearly labeled as a presentation preview rather than anatomy generation.
- AI score history, progress photo timeline, saved-photo rescanning, scan removal.
- Daily habits, custom routines, completion tracking, local-date week overview.
- Body analysis teaser, style/grooming directions, searchable educational library.
- Profile, reduced-motion preference, photo retention, validated JSON backup export/import, confirmed workspace clearing.
- Native keyboard-accessible dialogs, mobile navigation and responsive empty states.

## Separate geometry measurements

Coordinates are converted to image pixels. The eye line corrects head roll before projected proportions are calculated.

| Metric             | Measurement                                    | Reference | Tolerance | Weight |
| ------------------ | ---------------------------------------------- | --------: | --------: | -----: |
| Jaw width          | Jaw 172–397 / cheeks 234–454                   |      0.78 |      0.20 |    20% |
| Chin proportion    | Lip 17–chin 152 / nose 2–chin 152              |      0.50 |      0.20 |    15% |
| Midface balance    | Brow midpoint 105/334–nose 2 / nose 2–chin 152 |      0.90 |      0.35 |    20% |
| Eye aspect         | Mean visible eye width / lid height            |       3.2 |       1.5 |    15% |
| Canthal tilt       | Mean eye-corner angle, roll corrected          |        4° |       12° |    10% |
| Projected symmetry | Five mirrored landmark pairs                   | See below |         — |    20% |

The first five reference-band indices use `clamp(100 - 35 * abs(measurement - reference) / tolerance, 1, 100)`. Projected symmetry uses `clamp(100 - 250 * mean normalized paired-point error, 1, 100)`. The optional geometry summary is their rounded weighted mean. These editorial reference bands **do not generate the AI appearance rating** and are not universal beauty ideals.

Capture checks use head turn, roll, face size, face-crop luminance, Laplacian sharpness and expression blendshapes. Confidence is an application capture heuristic, not a model probability. Turn ≥30°, cheek width <85 pixels or confidence <55% withholds the geometry aggregate. Very low confidence or excessive turn also prevents AI scoring. No face or multiple faces produces an error without a substitute score.

## Run locally

Serve over localhost or HTTPS; `file://` cannot load the Workers correctly.

```sh
cd ascend
python -m http.server 8080
```

Visit `http://localhost:8080`. Allow the first model download to finish. Webcam capture needs browser permission. Close the scan to cancel inference. The AI worker is released after two idle minutes; downloaded weights can remain cached.

## Local data and privacy

Photos are resized to at most 640px and decoded in local Workers. The AI crop includes the face and surrounding hair. Photos and coordinates are **never uploaded** to Hugging Face, Google, jsDelivr, GitHub or a scoring service. Network requests retrieve runtime, WASM, model and font assets only. Google Fonts has local fallbacks.

`ascend.workspace.v1` localStorage holds preferences, habits, check-ins, plans and up to 20 reports. Saving compressed progress photos is optional. Disabling photo saving removes saved photographs when preferences are saved; reports remain. Browser storage is local, unencrypted and not synchronized. Exported backups can contain photographs, coordinates and AI responses. Import replaces the workspace with validated backup data. Never commit personal photographs or backup files to the public repository.

## Publish on GitHub Pages

### 1. Create a repository

1. Sign in at [GitHub](https://github.com).
2. Select **+ → New repository**.
3. Name it `ascend` or choose another name.
4. Select **Public** for free GitHub Pages hosting.
5. Click **Create repository**.

### 2. Upload the files

1. Open the repository and choose **Add file → Upload files** (or **uploading an existing file** in a new repository).
2. Upload all eight files listed above to the repository root.
3. Commit the files to `main`.
4. Do not upload photographs, exported backups or model caches.

Alternatively, from the project folder:

```sh
git init
git add index.html styles.css app.js analysis-core.js face-worker.js rating-core.js rating-worker.js README.md
git commit -m "Build Ascend with free on-device vision AI"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/ascend.git
git push -u origin main
```

### 3. Enable GitHub Pages

1. Open **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select `main` and `/ (root)`.
4. Click **Save**.
5. Wait for **pages build and deployment** in **Actions** to succeed.

### 4. Get the live link

1. Return to **Settings → Pages**.
2. Click **Visit site** or copy the displayed URL.
3. A repository called `ascend` normally publishes at `https://YOUR-USERNAME.github.io/ascend/`.
4. Open the live page and verify model loading, a scan and mobile navigation.

Every new commit to the publishing branch redeploys the site. Wait for deployment success before checking the update. This project needs no server secrets, environment variables or paid provider accounts.

## Verification checklist

1. A fresh workspace shows no sample rating.
2. Scan a clear portrait in AI mode; inspect the actual generated answers and real landmarks.
3. Rescan the identical photo in the same mode; verify cached result reuse.
4. Try measurements-only mode and confirm AI gauges stay unscored.
5. Try a no-face image, an unsuitable pose and a two-face image.
6. Cancel during model loading or generation; no late report should be saved.
7. Test unsupported WebGPU or a blocked model host; no fabricated score should appear.
8. Reload, export/import, disable photo saving and verify old fake ratings remain excluded.
9. Verify action plans, routines, library, profile, keyboard navigation and mobile layout.

## Upstream documentation

- [Qwen3-VL 2B upstream model](https://huggingface.co/Qwen/Qwen3-VL-2B-Instruct)
- [Qwen3-VL ONNX weights](https://huggingface.co/onnx-community/Qwen3-VL-2B-Instruct-ONNX)
- [SmolVLM 500M model](https://huggingface.co/HuggingFaceTB/SmolVLM-500M-Instruct)
- [Transformers.js WebGPU](https://huggingface.co/docs/transformers.js/guides/webgpu)
- [MediaPipe Face Landmarker for Web](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js)
- [GitHub Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [AAD sunscreen selection](https://www.aad.org/public/everyday-care/sun-protection/shade-clothing-sunscreen/how-to-select-sunscreen)
- [AAO mewing explanation](https://aaoinfo.org/whats-trending/is-mewing-bad-for-you/)
