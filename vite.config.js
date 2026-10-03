import { defineConfig } from 'vite';

// The actual project Pages URL is https://swirita.github.io/nawras-memory/.
// Local development stays at /; production preview uses the Pages subpath.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'serve' && !isPreview ? '/' : '/nawras-memory/',
}));
