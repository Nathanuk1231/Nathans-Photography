# Nathan Lloyd Photography — GSAP Portfolio

A responsive, dark editorial photography portfolio built with plain HTML, CSS, JavaScript and GSAP. No build tools or framework required.

## Files
- `index.html` — page structure, navigation, gallery, about and contact sections
- `styles.css` — responsive layout, neon blue/pink accents, hover states and reduced-motion support
- `app.js` — GSAP motion, mobile navigation, category filters and keyboard-accessible lightbox

## Before publishing
1. Replace the Unsplash preview photos with your own photographs. These are demo images, not Nathan's original work.
2. Check your Instagram URL and update it if needed.
3. Review all copy and labels before launch.

## Run locally
Open `index.html` in a browser. An internet connection is needed for Google Fonts, GSAP CDN and the remote preview images.

## Publish with GitHub Pages
1. Upload `index.html`, `styles.css`, `app.js`, and `README.md` into the repository root (or keep this folder as a preview).
2. In GitHub, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select `main` and `/ (root)`, then save.
5. Wait for GitHub Pages to finish deploying. The published address appears in Settings → Pages.

## Notes
- This is a static site. The Instagram link works without a backend; no contact form or fake email address is included.
- GSAP is loaded from jsDelivr. For offline/local hosting, download GSAP and update the script paths.
- The site respects `prefers-reduced-motion`.
