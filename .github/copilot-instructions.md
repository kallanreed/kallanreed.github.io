# Copilot Instructions

## Architecture

This is a **GitHub Pages site** (`kallanreed.github.io`) — a static hub with a collection of independent single-page application (SPA) applets. There is no build system, bundler, or server.

The root `index.html` is a simple landing page linking to each applet. Every applet is fully self-contained in its own directory with its own HTML, JS, CSS, and assets. There is no shared JavaScript across applets.

| Directory | Applet | Tech |
|-----------|--------|------|
| `bread-buddy/` | Bread/dough baking calculators | Vanilla JS |
| `respell/` | IPA → English respelling converter | Vanilla JS (ES6 classes) |
| `mk-dummy/` | Mage Knight board game dummy player simulator | Vanilla JS |
| `nw-gen/` | Nightwish-inspired lyrics generator | Vue.js 2 |
| `processing/` | Interactive simulations and visualizations | Processing (.pde) + p5.js/JS ports |

## Conventions

### Applet directory structure
```
applet-name/
├── index.html
├── [sub-page].html        # if the applet has multiple pages
├── code/
│   └── [applet-name].js   # primary logic
└── content/
    ├── [applet-name].css  # or style.css
    ├── icon.png
    └── [images/assets]
```
`processing/` diverges from this — JS ports live in subdirectories alongside `.pde` source files.

### JavaScript patterns
- Vanilla JS is the default; avoid introducing new frameworks.
- State is managed via **constructor functions** instantiated on page load into a global: `var context = new AppletContext();`
- ES6 class syntax is used in `respell/`; older constructor function syntax elsewhere — match the style of the file you're editing.
- `localStorage` is used for persistence in `mk-dummy/`.

### HTML patterns
- Every applet HTML includes: `viewport`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, and `author` meta tags.
- Google Analytics (UA-114278525-1) boilerplate is in every HTML file.
- No module system — styles and scripts load via `<link>`/`<script>` with relative paths.

### CSS
- Mobile-first, flexbox-based layouts.
- Each applet has its own scoped CSS; `content/style.css` at the root is only for the landing page.

### Assets
- Pixelmator `.pxm` source files are committed alongside exported PNGs in `mk-dummy/content/`.
- Processing `.pde` source files are committed alongside their JS ports in `processing/`.
