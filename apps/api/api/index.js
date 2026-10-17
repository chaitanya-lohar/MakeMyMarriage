// Vercel function entry (decision 0025). `pnpm run build` compiles the API into dist/ with tsc;
// every request is routed here by vercel.json, so Vercel never compiles the TypeScript itself.
export { default } from '../dist/vercel.js';
