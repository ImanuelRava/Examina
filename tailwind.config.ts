import type { Config } from "tailwindcss";

// Tailwind v4 reads its theme from `@theme inline {}` in src/app/globals.css.
// This file is kept only for IDE / type-check compatibility with any tooling
// that still imports it; it intentionally contains no theme overrides.
const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
};
export default config;
