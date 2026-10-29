import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {seedDatabase,getSchema,executeQuery} from '../database.js';
import {examples,localTranslate} from '../translator.js';

const directory=mkdtempSync(join(tmpdir(),'querydesk-test-'));
const path=join(directory,'test.sqlite');
seedDatabase(path);
test.after(()=>rmSync(directory,{recursive:true,force:true}));

test('sample database is reproducible and seed is idempotent',()=>{
  seedDatabase(path);
  assert.equal(getSchema(path).length,4);
  assert.equal(executeQuery(path,'SELECT count(*) AS n FROM orders').rows[0].n,180);
});
test('every suggested question generates executable SQL',()=>{
  for(const question of examples){const translated=localTranslate(question);const result=executeQuery(path,translated.sql);assert.ok(result.columns.length);assert.ok(translated.explanation);}
});
test('monthly and regional aggregates match completed revenue',()=>{
  const monthly=executeQuery(path,localTranslate(examples[0]).sql).rows;
  const regional=executeQuery(path,localTranslate(examples[3]).sql).rows;
  const total=executeQuery(path,localTranslate('What is total revenue?').sql).rows[0].total_revenue;
  assert.equal(monthly.reduce((n,row)=>n+row.revenue,0),total);
  assert.equal(regional.reduce((n,row)=>n+row.revenue,0),total);
  assert.equal(monthly.length,10);
});
test('top customers respects requested count',()=>assert.equal(executeQuery(path,localTranslate('Top 3 customers by spend').sql).rows.length,3));
test('mutations and file access are blocked by SQLite authorizer',()=>{
  for(const sql of ['DELETE FROM orders','PRAGMA table_info(orders)',"ATTACH DATABASE 'other.sqlite' AS other",'WITH x AS (SELECT 1) DELETE FROM orders',"SELECT load_extension('anything')"]){assert.throws(()=>executeQuery(path,sql));}
  assert.equal(executeQuery(path,'SELECT count(*) AS n FROM orders').rows[0].n,180);
});
test('results are capped at 500 rows',()=>{
  const data=executeQuery(path,'WITH RECURSIVE x(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM x WHERE n<1000) SELECT n FROM x');
  assert.equal(data.rows.length,500);assert.equal(data.truncated,true);
});
test('unknown natural language produces an actionable error',()=>assert.throws(()=>localTranslate('Predict next year'),/Sample mode/));
test('unsupported filters are not silently ignored',()=>assert.throws(()=>localTranslate('Revenue by month last year'),/does not support/));
