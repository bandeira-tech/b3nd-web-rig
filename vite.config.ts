import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const dntPolyfillStub = fileURLToPath(
  new URL("./src/_dnt-polyfills-stub.ts", import.meta.url),
);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // b3nd-move's npm dist (built via dnt) emits a `_dnt.polyfills.js`
      // that imports `node:module`/`node:url`/`node:path` for a CJS
      // `import.meta` ponyfill. The file is unused at runtime in the
      // browser; alias it to an empty module so Rollup doesn't choke.
      { find: /^.*_dnt\.polyfills(?:\.js)?$/, replacement: dntPolyfillStub },
    ],
  },
});
