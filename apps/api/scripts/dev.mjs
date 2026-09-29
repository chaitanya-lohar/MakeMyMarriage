// Local development runner: compiles with the same `tsc` used for production builds
// (decorator metadata is required by NestJS DI), then runs the HTTP API and the worker
// with `node --watch` so both restart whenever compiled output changes.
//
// Usage: node scripts/dev.mjs [--only=api|worker]
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const tscBin = require.resolve('typescript/bin/tsc');

const onlyArg = process.argv.find((arg) => arg.startsWith('--only='));
const only = onlyArg?.split('=')[1];
const entries = [
  { name: 'api', file: 'dist/main.js' },
  { name: 'worker', file: 'dist/worker.js' },
].filter((entry) => !only || entry.name === only);

const children = [];

function run(args) {
  const child = spawn(process.execPath, args, { stdio: 'inherit' });
  children.push(child);
  return child;
}

let started = false;
const tsc = spawn(
  process.execPath,
  [tscBin, '-p', 'tsconfig.build.json', '--watch', '--preserveWatchOutput'],
  { stdio: ['ignore', 'pipe', 'inherit'] },
);
children.push(tsc);

tsc.stdout.on('data', (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);
  if (!started && /Found 0 errors/.test(text)) {
    started = true;
    for (const entry of entries) {
      run([
        '--enable-source-maps',
        '--env-file-if-exists=.env',
        '--watch-path=dist',
        '--watch-preserve-output',
        entry.file,
      ]);
    }
  }
});

function shutdown() {
  for (const child of children) child.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
