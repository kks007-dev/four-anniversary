import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Must match the GitHub repository name for GitHub Pages asset paths.
export default defineConfig({
  plugins: [react()],
  base: "/four-anniversary/",
});
