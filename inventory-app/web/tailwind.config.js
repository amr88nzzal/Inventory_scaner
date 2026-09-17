/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#12181B",       // near-black with a cool green undertone, not pure #111
        slate: {
          950: "#0E1416",
        },
        graphite: "#2B3538",
        paper: "#F6F5F1",     // warm off-white, not stark white
        signal: "#C5601F",    // burnt-amber accent — warehouse tag / hazard-tape feel
        good: "#3E6B4F",      // muted olive-green for "in range"
        warn: "#B4472A",      // for variance/recount flags
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'IBM Plex Sans Arabic'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
