import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';

const root=fileURLToPath(new URL('../',import.meta.url));
await build({root});
// These URLs are served by the frontend service, not a filesystem API.
await fs.cp(new URL('../data/SPOT_KnightHacks_Challenge_Kit Part One/04_ASSETS/',import.meta.url),new URL('../dist/kit-assets/',import.meta.url),{recursive:true});
