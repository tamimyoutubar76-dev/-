# Chattogram Real-Life Open World: Lalkhan Bazar (লালখান বাজার)

A 1:1 real-world scale 3D open-world life simulation game reproducing **Lalkhan Bazar, Chattogram (Ward 14 & surrounding corridors), Bangladesh** using real OpenStreetMap GIS footprints and NASA SRTM 30m digital elevation terrain (`1 game meter = 1 real-world meter`).

## Verified Real-World GIS Survey

- **Center Origin**: `22.35042° N, 91.81678° E` (UTM Zone 46N: `378,243.4 m E, 2,472,226.4 m N`)
- **Total Mapped Area**: `2,217,600 m²` (`2.22 km²`, encompassing CCC Ward 14 `~1.24 km²` plus border corridors)
- **East–West Extent**: `1,540 m` (`-750 m` to `+790 m`)
- **North–South Extent**: `1,440 m` (`-680 m` to `+760 m`)
- **Road Network**: `239` mapped ways totaling `38,981 m` (`38.98 km`)
- **Mapped Intersections**: `234` junctions (`degree >= 3`)
- **Mapped Buildings**: `4,190` real building footprints + `13` enterable detailed landmarks & mosques
- **Terrain Elevation Range**: `11 m` to `59 m` ASL (Motijharna, Tankir Pahar, Batali Hill slope, Chanmari ridge, CDA Avenue valley)
- **Attribution**: Map geometries © OpenStreetMap contributors (ODbL); Elevation data from NASA SRTM 30m DEM via OpenTopoData.

## Run Locally

Requirements: Node.js 20+ and npm.

```bash
# 1. Install dependencies
npm install

# 2. Start the local development server on http://localhost:3000
npm run dev

# 3. Run deterministic GIS & simulation unit tests
npx --yes tsx --test src/sim/world.test.ts
```

## Build & Deploy Online

This is a self-contained Vite + React + Three.js static web application (all compiled GIS data lives in `src/data/lalkhanGisData.json` with zero external runtime API calls).

```bash
# Produce the production bundle in dist/
npm run build

# Preview the production bundle locally
npm run preview
```

Deploy the generated `dist/` directory to any static hosting provider:
- **Vercel / Netlify / Cloudflare Pages**: Connect the repository, set build command to `npm run build`, and output directory to `dist`.
- **Firebase Hosting / GitHub Pages**: Upload `dist/` after running `npm run build`.
