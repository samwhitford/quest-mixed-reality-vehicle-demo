import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default {
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  root: "src/",
  publicDir: "static/",
  base: '',
  plugins: [wasm(), topLevelAwait()],
  build: {
    rollupOptions: {
      treeshake: false,
    }
  }
};
