import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {fork} from 'node:child_process';
import {initialize,getSchema} from './database.js';
import {translate,examples} from './translator.js';

const database=initialize();
export function runQuery(sql) {
  return new Promise((resolve,reject)=>{
    // A subprocess can be killed even while SQLite is inside native execution.
    const child=fork(new URL('./query-process.js',import.meta.url),[],{stdio:['ignore','ignore','ignore','ipc'],execArgv:[]});
    let settled=false;
    const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);child.kill('SIGKILL');error?reject(error):resolve(result);};
    const timer=setTimeout(()=>finish(new Error('Query exceeded the 3 second limit. Simplify it and try again.')),3000);
    child.once('message',message=>finish(message.error?new Error(message.error):null,message.result));
    child.once('error',error=>finish(error));
    child.once('exit',()=>{if(!settled)finish(new Error('Query process stopped unexpectedly. Try a simpler query.'));});
    child.send({path:database,sql});
  });
}
const assets={'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/style.css':['style.css','text/css']};
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; frame-ancestors 'none'");
  const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  try {
    if(req.headers.origin && req.headers.origin!==`http://${req.headers.host}`) return json(403,{error:'Cross-origin requests are not allowed.'});
    const url=new URL(req.url,'http://localhost');
    if(req.method==='GET' && url.pathname==='/api/schema') return json(200,{tables:getSchema(database),examples,mode:process.env.OPENAI_API_KEY?'ai':'sample'});
    if(req.method==='POST'&&['/api/translate','/api/query'].includes(url.pathname)) {
      let body=''; for await(const chunk of req){body+=chunk;if(body.length>20000) return json(413,{error:'Request is too large.'});}
      let input;try{input=JSON.parse(body);}catch{return json(400,{error:'Request must contain valid JSON.'});}
      if(url.pathname==='/api/translate') {
        if(typeof input.question!=='string'||!input.question.trim()||input.question.length>2000) return json(400,{error:'Enter a question of 1–2000 characters.'});
        return json(200,await translate(input.question,getSchema(database)));
      }
      return json(200,await runQuery(input.sql));
    }
    if(req.method==='GET'&&assets[url.pathname]){const [file,type]=assets[url.pathname];res.writeHead(200,{'Content-Type':type});return res.end(await readFile(new URL(`./public/${file}`,import.meta.url)));}
    json(404,{error:'Page not found.'});
  } catch(error){json(400,{error:error.message});}
});
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  server.on('error',error=>{
    console.error(error.code==='EADDRINUSE' ? `Port ${Number(process.env.PORT)||3000} is already in use. Set PORT in .env to another port and restart.` : error.message);
    process.exitCode=1;
  });
  server.listen(Number(process.env.PORT)||3000,'127.0.0.1',()=>console.log(`Querydesk is ready at http://localhost:${Number(process.env.PORT)||3000}`));
}
export {server};
