// Tailwind v4 through PostCSS, because this is Next/webpack — the reference app uses
// @tailwindcss/vite, which does not apply here.
//
// Which Tailwind LAYERS get imported is decided in app/globals.css, and that choice is
// load-bearing: preflight is deliberately left out. See the comment there.
module.exports = {
  plugins: {
    "@tailwindcss/postcss": {}
  }
};
