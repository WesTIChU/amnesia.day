import { startServer } from './app.js';

// Production entrypoint. This file is the esbuild bundle target (CJS), so it
// starts the server unconditionally: being the bundle's entrypoint is exactly
// what "run directly" means. It contains no import.meta, keeping the CommonJS
// bundle free of esbuild warnings.
startServer();
