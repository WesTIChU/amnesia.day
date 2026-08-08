import { pathToFileURL } from 'node:url';
import { startServer } from './server/app.js';

export { buildApp, startServer } from './server/app.js';

// Development entrypoint. This module is executed directly with `tsx server.ts`
// to start the development server, and imported by tests to access buildApp
// without binding a listener. The production bundle uses server/start.ts, so
// this module's import.meta reference is never compiled by esbuild.
const isMainModule = Boolean(
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href,
);

if (isMainModule) {
  startServer();
}
