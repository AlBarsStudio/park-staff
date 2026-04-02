import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 👇 Замените 'НАЗВАНИЕ-РЕПОЗИТОРИЯ' на реальное имя вашего репозитория
const REPO_NAME = 'НАЗВАНИЕ-РЕПОЗИТОРИЯ';

export default defineConfig({
  plugins: [react(), tailwindcss()],  // убрал viteSingleFile – он не нужен
  base: `/${REPO_NAME}/`,            // <- ЭТО САМОЕ ВАЖНОЕ
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: 'dist',                  // папка, куда Vite соберёт сайт
    emptyOutDir: true,
  },
});
