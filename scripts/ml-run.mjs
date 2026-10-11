import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {query,dbConfig,table} from '../databricks.mjs';
import {sourceSignature,sourceNames,publishSQL} from '../ml-queries.mjs';
if(fs.existsSync('.env'))process.loadEnvFile('.env');
const {catalog,schema}=dbConfig();table('ml_runs');
const dir=path.resolve('ml/artifacts');fs.mkdirSync(dir,{recursive:true});
const python=process.env.SPOTLIGHT_PYTHON||path.resolve(process.platform==='win32'?'ml/.venv/Scripts/python.exe':'ml/.venv/bin/python');
async function publish(result){
 if(await sourceSignature()!==result.metrics.source_signature)throw Error('Raw data changed since extraction; retrain before publication');
 await query(publishSQL(result));
 console.log(`Published ${result.predictions.length} forecasts and model metrics atomically in ${table('ml_runs')}`);
}
if(process.argv.includes('--publish-existing')){
 await publish(JSON.parse(fs.readFileSync(path.join(dir,'results.json'),'utf8')));
}else{
 // Capture schema inspection for reproducibility. Never log environment credentials.
 const schemas={};for(const name of sourceNames)schemas[name]=await query(`DESCRIBE TABLE ${table(name)}`);
 fs.writeFileSync(path.join(dir,'schemas.json'),JSON.stringify(schemas,null,2));
 for(const file of ['ml_features.sql','ml_predictions.sql']){
  const sql=fs.readFileSync(path.join('databricks',file),'utf8').replaceAll('workspace.spotlight',`${catalog}.${schema}`);
  for(const statement of sql.replace(/^--.*$/gm,'').split(';').filter(s=>s.trim()))await query(statement);
 }
 const signature=await sourceSignature();
 const rows=await query(`SELECT * FROM ${table('ml_action_features')} ORDER BY target_kind,target_id`);
 const history=await query(`SELECT * FROM ${table('ml_eligible_actions')} ORDER BY action_at,mission_id,sequence,action_id`);
 const audit=await query(`SELECT (SELECT COUNT(*) FROM ${table('actions')}) raw_actions,COUNT(*) eligible_actions,COUNT_IF(label=1) failed_actions,COUNT_IF(label=0) successful_actions FROM ${table('ml_eligible_actions')}`);
 if(await sourceSignature()!==signature)throw Error('Raw data changed during feature extraction; retry');
 const input=path.join(dir,'features.json');
 fs.writeFileSync(input,JSON.stringify({rows,history,source_signature:signature,source_tables:sourceNames.map(table),audit:audit[0]},null,2));
 const training=spawnSync(python,['ml/train.py','--input',input,'--output',dir],{stdio:'inherit'});
 if(training.error)throw Error(`Cannot start Python: ${training.error.message}. Create ml/.venv or set SPOTLIGHT_PYTHON.`);
 if(training.status!==0)throw Error('Model training/validation failed; no forecasts were published');
 if(!process.argv.includes('--no-publish'))await publish(JSON.parse(fs.readFileSync(path.join(dir,'results.json'),'utf8')));
}
