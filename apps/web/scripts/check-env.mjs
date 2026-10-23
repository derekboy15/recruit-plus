/** Stops a build whose env would ship a broken production site (scripts/env.mjs). Runs before `vite build`. */
import { checkEnv } from './env.mjs';

const problems = checkEnv(process.env, (w) => console.warn(`warning: ${w}`));
for (const p of problems) console.error(`error: ${p}`);
if (problems.length) process.exit(1);
