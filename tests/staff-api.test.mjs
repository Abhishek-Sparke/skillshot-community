import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import * as roles from '../lib/roles.ts';
import * as query from '../lib/staff-query.ts';

// Execute the real route handlers with isolated authentication/database adapters.
// No production credentials, auth bypasses or database mutations are involved.
async function route(name, role, row = {}, custom = []) {
  const permissions = roles.permissionsFor(role, custom);
  const calls = [];
  const principal = {id:'actor',role,status:'ACTIVE',permissions,profile:{}};
  const db = {query:async(sql,values)=>{calls.push({sql,values});return row ? [row] : [];}};
  const source=await readFile(new URL(`../app/api/staff/${name}/route.ts`,import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const routeModule={exports:{}};
  const require=(id)=>{
    if(id.endsWith('/authz'))return {requirePrincipal:async(permission)=>permission&&!permissions.includes(permission)?{error:Response.json({error:'Forbidden'},{status:403})}:{principal}};
    if(id.endsWith('/db'))return {getReadyDb:async()=>db};
    if(id.endsWith('/roles'))return roles;
    if(id.endsWith('/staff-query'))return query;
    throw new Error(`Unexpected route dependency: ${id}`);
  };
  new Function('require','module','exports',code)(require,routeModule,routeModule.exports);
  return {handler:routeModule.exports,calls};
}
const patch=(body)=>new Request('https://local.test/api/staff/test',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(body)});

test('staff API handlers reject non-staff without querying staff data',async()=>{
  for(const role of ['USER','TRUSTED_CONTRIBUTOR'])for(const name of ['overview','moderation','audit','team','users']){
    const {handler,calls}=await route(name,role);
    assert.equal((await handler.GET(new Request(`https://local.test/api/staff/${name}`))).status,403,`${role}: ${name}`);
    assert.equal(calls.length,0);
  }
});
test('role API rejects self changes, peer changes and forbidden promotions',async()=>{
  for(const [actor,target,next,id] of [['HEAD_MODERATOR','USER','ADMIN','target'],['ADMIN','ADMIN','USER','target'],['ADMIN','USER','ADMIN','target'],['OWNER','USER','ADMIN','actor']]){
    const {handler,calls}=await route('team',actor,{role:target,username:'target'});
    assert.equal((await handler.PATCH(patch({userId:id,role:next}))).status,403);
    assert.equal(calls.some(c=>/UPDATE|INSERT/.test(c.sql)),false);
  }
});
test('moderators cannot delete Skillshots and profile actions remain unsupported',async()=>{
  const {handler,calls}=await route('moderation','MODERATOR',{target_type:'SKILLSHOT',target_id:'post'});
  assert.equal((await handler.PATCH(patch({queueId:'queue',action:'DELETE'}))).status,403);
  assert.equal(calls.some(c=>/UPDATE|INSERT/.test(c.sql)),false);
  const profile=await route('moderation','OWNER',{target_type:'PROFILE',target_id:'user'});
  assert.equal((await profile.handler.PATCH(patch({queueId:'queue',action:'APPROVE'}))).status,400);
});
test('head-moderator history is actor-scoped and cannot expose the full audit log',async()=>{
  const audit=await route('audit','HEAD_MODERATOR',null);
  assert.equal((await audit.handler.GET(new Request('https://local.test/api/staff/audit'))).status,403);
  const result=await audit.handler.GET(new Request('https://local.test/api/staff/audit?scope=moderation'));
  assert.equal(result.status,200);assert.equal((await result.json()).ownOnly,true);
  assert.equal(audit.calls[0].values[5],'actor');
  const mod=await route('audit','MODERATOR');
  assert.equal((await mod.handler.GET(new Request('https://local.test/api/staff/audit?scope=moderation'))).status,403);
});
test('moderation filtering and pagination are passed to the database, not browser-only',async()=>{
  const {handler,calls}=await route('moderation','ADMIN',null);
  const result=await handler.GET(new Request('https://local.test/api/staff/moderation?type=COMMENT&source=REPORT&status=DISMISSED&reason=spam&page=3'));
  assert.equal(result.status,200);
  assert.deepEqual(calls[0].values.slice(0,6),['COMMENT','REPORT','DISMISSED','ALL','%spam%',40]);
  assert.match(calls[0].sql,/LIMIT 21 OFFSET/);
});
