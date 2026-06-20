import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular"]
      },
      colors: {
        ink: "#171717",
        paper: "#f7f4ee",
        clay: "#b9674e",
        moss: "#4f6f52",
        brass: "#b28a3f"
      },
      boxShadow: {
        diffusion: "0 24px 80px -36px rgba(23, 23, 23, 0.28)"
      }
    }
  },
  plugins: []
};

export default config;
