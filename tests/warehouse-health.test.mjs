import test from 'node:test';
import assert from 'node:assert/strict';
import {warehouseHealth} from '../databricks.mjs';
test('passive health reads stopped warehouse metadata without sending SQL or start commands',async()=>{
 const keys=['DATABRICKS_HOST','DATABRICKS_TOKEN','DATABRICKS_WAREHOUSE_ID'];const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 Object.assign(process.env,{DATABRICKS_HOST:'test.cloud.databricks.com',DATABRICKS_TOKEN:'test-token',DATABRICKS_WAREHOUSE_ID:'test-warehouse'});
 try{let calls=0;const result=await warehouseHealth(async(url,options)=>{calls++;assert.equal(url,'https://test.cloud.databricks.com/api/2.0/sql/warehouses/test-warehouse');assert.equal(options.method,'GET');assert.equal(options.body,undefined);return {ok:true,json:async()=>({state:'STOPPED',name:'Test warehouse',token:'must-not-leak'})};});assert.equal(calls,1);assert.equal(result.state,'STOPPED');assert.equal(result.sql_tested,false);assert.equal(result.token,undefined);
 await assert.rejects(warehouseHealth(async()=>({ok:false,status:403})),/HTTP 403/);
 }finally{for(const key of keys){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}}
});
