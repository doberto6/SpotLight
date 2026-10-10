import fs from 'node:fs';
import {query,dbConfig} from '../databricks.mjs';
if(fs.existsSync('.env'))process.loadEnvFile('.env');
const {catalog,schema}=dbConfig();
if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(catalog)||!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema))throw Error('Invalid catalog/schema');
for(const file of ['mission-intelligence.sql','sensor-trends.sql']){
 const sql=fs.readFileSync(new URL(file,import.meta.url),'utf8').replaceAll('workspace.spotlight',`${catalog}.${schema}`);
 for(const statement of sql.split(';').filter(s=>s.trim())){await query(statement);console.log('Created intelligence view');}
}
