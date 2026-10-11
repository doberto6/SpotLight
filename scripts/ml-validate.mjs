import path from 'node:path';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
if(fs.existsSync('.env'))process.loadEnvFile('.env');
const python=process.env.SPOTLIGHT_PYTHON||path.resolve(process.platform==='win32'?'ml/.venv/Scripts/python.exe':'ml/.venv/bin/python');
const result=spawnSync(python,['-m','unittest','discover','-s','ml','-p','test_*.py'],{stdio:'inherit'});
if(result.error)throw result.error;
process.exitCode=result.status;
