/**
 * Connect Tailwind CSS v4 to the CSS build pipeline. Its PostCSS plugin expands the
 * Tailwind import and theme utilities used by globals.css and the React components.
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
