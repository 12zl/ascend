# Ascend

A premium, responsive single-page facial-analysis concept built with plain HTML, CSS, and JavaScript. No package installation, API key, backend, or build step is required.

## Files

```text
ascend/
├── index.html     # Application shell, accessible navigation, and native dialogs
├── styles.css     # Responsive dark theme, component styles, and animation
├── app.js         # Simulation, canvas face map, persistence, and interactions
└── README.md      # Setup, behavior, publishing, and implementation notes
```

Keep the three application files together. All application asset paths are relative, so deployment works under a GitHub Pages repository subpath. Typography uses Google Fonts with local sans-serif fallbacks. The app otherwise has no external runtime dependencies; all icons and decorative facial graphics are generated locally.

## Run locally

Open `index.html` to explore the interface and upload a photo. For webcam access, serve the directory on localhost or use an HTTPS deployment. For example, with Python installed:

```sh
cd ascend
python -m http.server 8080
```

Visit `http://localhost:8080`. Allow camera access when choosing **Use webcam**. If a camera is unavailable or permission is denied, upload a photo instead.

## Included experiences

- Landing / overview with an original animated 3D canvas face map.
- Photo upload and drag-and-drop for JPEG, PNG, and WebP, up to 12 MB.
- Webcam preview, capture, clear permission/error states, and track cleanup.
- Staged loading sequence and deterministic simulated analysis.
- Resting Face Score and Potential Score, both between 1 and 100, with gauges.
- Eight metric panels: jaw, chin, midface, eye area, canthal tilt approximation, symmetry, skin, and hairline.
- **What You Need to Fix** with specific example observations, severity, concrete recommendations, guide links, and actions to add priorities to the plan.
- **Current vs Potential** side-by-side comparison with adjustable lighting preview.
- Score history chart, progress photo timeline, individual scan removal, and up to 20 saved scan records.
- Prioritized action plan with completion tracking and conversion to daily habits.
- Daily habit tracker, custom habits, deletion, week overview, and historical check-in total.
- Body analysis teaser with a working route to a movement routine.
- Three style directions with tailored hair, wardrobe, and grooming content.
- Six searchable, filterable educational guides in reading dialogs.
- Profile name, primary focus, photo storage preference, reduced motion, JSON export/import, and confirmed data deletion.
- Browser-local persistence, responsive layouts, keyboard focus styles, native focus-trapped dialogs, accessible chart/gauge descriptions, and system reduced-motion support.

## Analysis engine: what is simulated

This release implements the explicitly supported **realistic simulated analysis** option. It does not include face-api.js, a trained model, face detection, clinical inference, or a real attractiveness estimator.

1. The browser decodes the image and downsamples it to at most 640 pixels on its longest edge.
2. The result is re-encoded as JPEG, excluding the original file metadata.
3. The original uploaded file bytes are hashed using FNV-style integer operations. Webcam captures use the captured image bytes. Hashing before canvas rendering keeps repeated uploads consistent across browser canvas variations.
4. The hash seeds a deterministic linear congruential generator, producing illustrative feature values, a resting score, an example angle, and a higher potential score.
5. The eight metric scores determine the ordering of example recommendations. The report labels all observations and severities as examples.

The same uploaded file produces the same scores. Different files, crops, or encodings can change them. Scores are not biometric measurements, diagnoses, or evidence of physical progress. Blank storage shows a clearly labeled sample report; the progress page stays empty until an actual user scan is recorded.

The Potential photo uses only CSS contrast, brightness, and saturation changes. It preserves facial anatomy and is labeled as an illustrative lighting preview, not a treatment prediction. Without a retained photo, an original vector face outline occupies the comparison frames.

To integrate a real analyzer, replace `simulateAnalysis()` and adapt the metric fields. Document its validated capabilities, load models locally when possible, and update the simulation labels only when the implementation supports those claims.

## Local data and privacy

- No uploaded photo is sent to a server. Image processing and storage happen in the browser.
- The `ascend.workspace.v1` localStorage key contains profile settings, scan hashes, optionally compressed photos, habits, plan items, and daily completion records.
- Data is scoped to this browser and origin. It does not synchronize across devices. Private browsing, clearing site data, or changing domains can remove or hide the workspace.
- Disabling **Save progress photos** and saving preferences also removes photos from existing scan records. Scores remain.
- A maximum of 20 scans is retained. The oldest record is removed when the limit is reached.
- If image storage exceeds the browser quota, the newest scan is saved without its photo where possible. Export provides a portable backup.
- Exported JSON can include face photos. Import restores a validated backup in place of the current workspace.
- Camera tracks stop on capture, mode switch, dialog closure, or leaving the page.
- Fonts are fetched from Google Fonts; their failure does not block the app.
- localStorage is convenience storage, not encryption or a multi-user security boundary.

## Publish on GitHub Pages

### 1. Create a GitHub repository

1. Sign in at [github.com](https://github.com).
2. Click **+ → New repository**.
3. Enter a name such as `ascend`.
4. Choose **Public** for straightforward free Pages hosting. Private repository Pages availability depends on your GitHub plan.
5. Click **Create repository**.

### 2. Upload the files

1. Open the repository.
2. Choose **Add file → Upload files**. In a completely empty repository, use the **uploading an existing file** link.
3. Drag in `index.html`, `styles.css`, `app.js`, and `README.md` from this folder.
4. Put these files at the **repository root**, not inside an extra `ascend` directory.
5. Click **Commit changes** and commit to `main`.

Alternatively, use Git from the project folder:

```sh
git init
git add index.html styles.css app.js README.md
git commit -m "Build Ascend frontend"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/ascend.git
git push -u origin main
```

Replace `YOUR-USERNAME` and the repository name with your own values.

### 3. Enable GitHub Pages

1. In the repository, open **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select the `main` branch and the `/ (root)` folder.
4. Click **Save**.
5. Allow the Pages deployment to complete. Check the repository's **Actions** tab if you need to inspect deployment progress.

### 4. Get your live link

1. Return to **Settings → Pages** after deployment succeeds.
2. Use **Visit site**, or copy the displayed URL.
3. For a repository named `ascend`, the usual URL is `https://YOUR-USERNAME.github.io/ascend/`.
4. Open that URL and verify the overview, photo upload, and webcam permission flow. GitHub Pages provides HTTPS, which enables the webcam API in supporting browsers.

Pushing edits to `main` triggers another deployment. Wait for that deployment to succeed before checking the changed live site.

## Manual acceptance checks

1. Load a fresh workspace: overview shows **Demo report**; progress shows an empty state.
2. Upload a portrait; verify preview, progress stages, report, metrics, priorities, and comparison slider.
3. Scan the same file twice; verify matching simulated scores and two timeline records.
4. Reload: confirm scans, profile, and routines persist.
5. Check a habit; confirm its state updates on the overview and routine pages.
6. Add a custom habit and remove it. Complete a plan item, add another from the report, and convert it to a habit.
7. Search and filter the library; read an article and close it with Escape.
8. Change style directions and profile settings. Export a backup; import it and check that it restores the workspace.
9. Disable photo saving, save settings, and verify the timeline retains scores with photo placeholders.
10. Test a denied webcam permission, a missing camera, an invalid upload, a very small image, and a file above 12 MB.
11. On a camera-equipped device, allow permission, capture a photo, and verify the camera indicator stops after capture or dismissal.
12. Check desktop and 390px mobile layouts, menu navigation, keyboard focus, dialogs, and reduced motion.
13. Clear data through the confirmation dialog; verify the initial empty and demo states return.

## Browser support

Current Chrome, Edge, Firefox, and Safari with support for native `dialog`, Canvas 2D, CSS conic gradients, ResizeObserver, and modern JavaScript. Webcam capture requires a secure context and user permission. No service worker or offline install layer is included.

## Editorial sources

- [American Academy of Dermatology: how to select sunscreen](https://www.aad.org/public/everyday-care/sun-protection/shade-clothing-sunscreen/how-to-select-sunscreen)
- [American Association of Orthodontists: mewing explained](https://aaoinfo.org/whats-trending/is-mewing-bad-for-you/)
- [GitHub Docs: configuring a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

The application is complete as a static frontend product demonstration. Real biometric analysis, accounts, cloud synchronization, billing, clinical recommendations, and automatic GitHub repository creation are outside this frontend implementation.
