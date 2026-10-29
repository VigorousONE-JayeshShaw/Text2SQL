import test from 'node:test';
import assert from 'node:assert/strict';
import {server,runQuery} from '../server.js';

test('subprocess runs SQL and terminates long-running queries',async()=>{
  assert.equal((await runQuery('SELECT 42 AS answer')).rows[0].answer,42);
  await assert.rejects(runQuery('WITH RECURSIVE x(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM x) SELECT sum(n) FROM x'),/3 second/);
});

// Opt in for HTTP tests on hosts where local sockets are permitted.
test('HTTP question-to-results flow and invalid request handling',{skip:!process.env.TEST_HTTP},async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const base=`http://127.0.0.1:${server.address().port}`;
    const schema=await fetch(base+'/api/schema').then(r=>r.json());
    assert.equal(schema.tables.length,4);
    const translation=await fetch(base+'/api/translate',{method:'POST',body:JSON.stringify({question:'Who are our top 5 customers?'})}).then(r=>r.json());
    const result=await fetch(base+'/api/query',{method:'POST',body:JSON.stringify({sql:translation.sql})}).then(r=>r.json());
    assert.equal(result.rows.length,5);
    assert.equal((await fetch(base+'/api/query',{method:'POST',body:'invalid'})).status,400);
    assert.equal((await fetch(base+'/api/query',{method:'POST',body:JSON.stringify({sql:'DELETE FROM customers'})})).status,400);
    assert.equal((await fetch(base+'/api/query',{method:'POST',headers:{Origin:'http://unrelated.example'},body:'{}'})).status,403);
    assert.equal((await fetch(base+'/')).status,200);
    assert.equal((await fetch(base+'/../package.json')).status,404);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
