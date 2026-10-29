import {executeQuery} from './database.js';
process.once('message',({path,sql})=>{
  try { process.send({result:executeQuery(path,sql)}); }
  catch(error) { process.send({error:error.message}); }
});
