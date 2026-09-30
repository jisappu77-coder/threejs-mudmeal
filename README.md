# Mud Meals — Kochi Outskirts

A landscape Three.js delivery scene inspired by the supplied Kerala reference: tiled roofs, curved roads, traffic, palms, rice fields, a canal and bridge, with a delivery HUD and animated riders. The scene uses detailed procedural geometry and textured materials. It remains a visual recreation and interactive prototype; it is not a pixel-identical reproduction or a complete delivery game.

**Website:** https://jisappu77-coder.github.io/threejs-mudmeal/

## Run locally

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Arrow keys or WASD steer; accelerate/brake buttons control speed. Space pauses. The gear menu offers free camera, reset, the reference image, HUD toggle and fullscreen. Press H to restore a hidden HUD. Portrait phones show a landscape prompt. WebGL 2 is required; unsupported browsers show an explanatory message.

## Checks and deployment

```sh
npm run check
npm run build
npx playwright install chromium
npm run preview
# In another terminal:
npm run check:browser
```

The single GitHub Actions workflow checks scene construction, builds the website, and tests the production build in Chromium. Browser screenshots are attached to the workflow run. Successful pushes to main deploy dist/ to GitHub Pages; pull requests run checks without deploying. Pages uses the repository's existing GitHub Actions configuration.

src/scene.js contains the scene and interaction; src/graphics.js configures ambient occlusion and rendering; src/style.css provides the responsive HUD. public/ contains the supplied reference and food image. Design notes remain in docs/. Earlier placeholder models and duplicated workflows were removed; their history remains in Git.
