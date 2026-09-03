import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import sharp from 'sharp';
import { PGlite } from '@electric-sql/pglite';
import { REPORT_CASE_MIGRATION } from '../lib/report-case-schema.ts';
import { SEARCH_MIGRATION } from '../lib/search-schema.ts';
import { SETTINGS_MIGRATION } from '../lib/settings-schema.ts';
import { TRUSTED_MIGRATION } from '../lib/trusted-schema.ts';
import { COMMENT_MIGRATION } from '../lib/comment-schema.ts';
import * as settingsPolicy from '../lib/settings-policy.ts';
import * as trustedPolicy from '../lib/trusted-policy.ts';
import * as searchPolicy from '../lib/search-query.ts';
import * as roles from '../lib/roles.ts';
import { moderationFrames,processSkillshot,processAvatar } from '../lib/image-processing.ts';
import { sampledFrames } from '../lib/upload-policy.ts';
import { gifInfo } from '../lib/gif-info.ts';
import * as casePolicy from '../lib/report-case-policy.ts';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
async function load(path,deps){const loaded={exports:{}};const code=ts.transpileModule(await read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(id=>{const key=Object.keys(deps).find(key=>id.endsWith(key));if(!key)throw Error('Missing dependency '+id);return deps[key];},loaded,loaded.exports);return loaded.exports;}
async function setup(){
  const db=new PGlite();const schema=await read('lib/db.ts');
  for(const match of schema.matchAll(/await sql\.query\(`([^`]+)`\);/g))if(/^(CREATE|ALTER|UPDATE users SET role)/.test(match[1]))await db.query(match[1]);
  for(const migration of [REPORT_CASE_MIGRATION,SEARCH_MIGRATION,SETTINGS_MIGRATION,TRUSTED_MIGRATION,COMMENT_MIGRATION])for(const statement of migration)await db.query(statement);
  await db.exec(`INSERT INTO users(id,email,display_name,username,role,created_at)VALUES('owner','owner@test.invalid','Owner','owner','OWNER',now()-interval '1 year'),('user','user@test.invalid','Creator','creator','USER',now()-interval '1 year'),('other','other@test.invalid','Other','other','USER',now()-interval '1 year');
    INSERT INTO posts(id,user_id,title,description,skills,tags,category,image_url,image_type,image_size)VALUES('post','user','Figma interface','Design work','["Figma"]','["UI"]','Design','private/post','image/png',100),('related','other','Second design','Another interface','["Figma"]','["UI"]','Design','private/related','image/png',100),('hidden','other','Hidden design','','[]','[]','Design','private/hidden','image/png',100);
    UPDATE posts SET status='PENDING_MODERATION' WHERE id='hidden';`);
  let actor={id:'user',role:'USER',status:'ACTIVE',email:'user@test.invalid',profile:{display_name:'Creator'},permissions:[]};
  const sql={query:async(text,values=[])=>{try{return(await db.query(text,values)).rows;}catch(error){error.message+='\nQUERY: '+text;throw error;}},transaction:async writes=>Promise.all(writes)};
  const deps={'/db':{getReadyDb:async()=>sql,ensureUser:async()=>({username:'creator',display_name:'Creator',role:'USER'})},'/authz':{requirePrincipal:async permission=>!actor?{error:Response.json({error:'Unauthorized'},{status:401})}:permission&&!actor.permissions.includes(permission)?{error:Response.json({error:'Forbidden'},{status:403})}:{principal:actor}},'/chatgpt-auth':{getChatGPTUser:async()=>actor?{userId:actor.id}:null},'/roles':roles,'/rate-limit':{rateLimit:async()=>true},'/settings-policy':settingsPolicy,'/trusted-policy':trustedPolicy,'/search-query':searchPolicy,'/moderation':{moderateText:async()=>({level:'SAFE'}),commentModerationError:()=>null}};
  deps['/trusted-data']=await load('lib/trusted-data.ts',deps);deps['/comment-notifications']=await load('lib/comment-notifications.ts',deps);
  return {db,sql,deps,as(role,id=role==='OWNER'?'owner':'user'){actor=role?{id,role,status:'ACTIVE',email:id+'@test.invalid',profile:{display_name:'Creator'},permissions:roles.permissionsFor(role)}:null;},route:path=>load(path,deps)};
}
const request=body=>new Request('https://local.test/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
test('private settings, support, applications and case image endpoints reject unauthenticated access before data use',async()=>{
  const fail=()=>{throw Error('Unauthorized data access');};
  const deps={'/authz':{requirePrincipal:async()=>({error:Response.json({error:'Unauthorized'},{status:401})})},'/db':{getReadyDb:fail},'/rate-limit':{rateLimit:fail},'/roles':roles,'/settings-policy':settingsPolicy,'/trusted-policy':trustedPolicy,'/trusted-data':{trustedProgress:fail},'/report-case-policy':casePolicy,'/report-case-data':{findCase:fail,caseContent:fail},'/report-case-actions':{mutateCase:fail},'/image-delivery':{imageDelivery:fail},'@vercel/blob':{get:fail}};
  for(const path of ['app/api/settings/route.ts','app/api/support/route.ts','app/api/trusted-contributor/route.ts','app/api/staff/trusted-contributors/route.ts','app/api/staff/cases/route.ts','app/api/staff/cases/[id]/route.ts','app/api/staff/cases/[id]/image/route.ts','app/api/posts/[id]/comments/pin/route.ts']){
    const route=await load(path,deps);for(const method of ['GET','POST','PATCH'])if(route[method])assert.equal((await route[method](request({}),{params:Promise.resolve({id:'private'})})).status,401,path+' '+method);
  }
});
test('GIF frames span the animation, animated display survives, thumbnails stay small, avatars reject GIF',async()=>{
  // Three distinct frames prevent the encoder from collapsing identical frames.
  const images=await Promise.all(['red','green','blue'].map(background=>sharp({create:{width:8,height:8,channels:3,background}}).png().toBuffer()));
  const gif=await sharp(images,{join:{animated:true}}).gif({delay:[100,100,100],loop:0}).toBuffer();
  assert.equal(gifInfo(gif).frames,3);
  const frames=await moderationFrames(gif,'image/gif');assert.equal(frames.length,3);assert.notEqual(frames[0],frames[2]);
  assert.equal(sampledFrames(120)[0],0);assert.equal(sampledFrames(120).at(-1),119);assert.equal(sampledFrames(120).length,12);
  const processed=await processSkillshot(gif,'image/gif');assert.equal((await sharp(processed.display).metadata()).pages,3);assert.equal((await sharp(processed.thumbnail).metadata()).pages||1,1);
  await assert.rejects(processAvatar(gif,'image/gif'));
  await assert.rejects(moderationFrames(gif,'image/png'));
});
test('real PostgreSQL search and related results exclude held posts and bound results',async()=>{
  const ctx=await setup();try{
    const search=await ctx.route('app/api/search/route.ts');const response=await search.GET(new Request('https://local.test/api/search?q=Figma'));
    assert.equal(response.status,200);const result=await response.json();assert.ok(result.shots.some(row=>row.id==='post'));assert.ok(!result.shots.some(row=>row.id==='hidden'));
    const related=await ctx.route('lib/related-posts.ts');const rows=await related.relatedPosts('post');assert.equal(rows[0].id,'related');assert.ok(!rows.some(row=>['post','hidden'].includes(row.id)));
    assert.deepEqual(await related.relatedPosts('hidden'),[]);
    for(const statement of SEARCH_MIGRATION)await ctx.db.query(statement);
  }finally{await ctx.db.close();}
});
test('settings persist, reject private field injection and enforce preferences on notification insert',async()=>{
  const ctx=await setup();try{
    const route=await ctx.route('app/api/settings/route.ts');assert.equal((await route.PATCH(request({theme:'dark',notifications:{likes:false}}))).status,200);
    assert.equal((await ctx.sql.query(`SELECT preferences->>'theme' theme FROM users WHERE id='user'`))[0].theme,'dark');
    assert.equal((await route.PATCH(request({role:'OWNER'}))).status,400);assert.equal((await route.PATCH(request({notifications:{security:false}}))).status,400);
    await ctx.db.exec(`INSERT INTO notifications(id,user_id,type,title)VALUES('like','user','LIKE','Like'),('security','user','ACCOUNT','Security');`);
    assert.deepEqual((await ctx.sql.query('SELECT id FROM notifications')).map(row=>row.id),['security']);
    ctx.as(null);assert.equal((await route.GET()).status,401);assert.equal((await route.PATCH(request({theme:'light'}))).status,401);
  }finally{await ctx.db.close();}
});
test('trusted applications require eligibility, reject duplicates and self-grants; staff decisions update role atomically',async()=>{
  const ctx=await setup();try{
    const route=await ctx.route('app/api/trusted-contributor/route.ts'),staff=await ctx.route('app/api/staff/trusted-contributors/route.ts');
    const body={reason:'I contribute useful work to the community regularly.',contribution:'I help other creators improve through constructive feedback.',contentTypes:'Design and photography',confirmed:true};
    assert.equal((await route.POST(request(body))).status,409);
    ctx.as('OWNER');assert.equal((await staff.PATCH(request({action:'CONFIGURE',config:{accountDays:0,posts:0,participation:0,rejectionDays:0,appealDays:0,appealsEnabled:true,violationDays:90}}))).status,200);
    ctx.as('USER');const submitted=await route.POST(request(body));assert.equal(submitted.status,201);const {id}=await submitted.json();assert.equal((await route.POST(request(body))).status,409);
    assert.equal((await staff.PATCH(request({action:'APPROVE',applicationId:id,version:0}))).status,403);
    ctx.as('OWNER');const approved=await staff.PATCH(request({action:'APPROVE',applicationId:id,version:0}));assert.equal(approved.status,200,JSON.stringify(await approved.json()));
    assert.equal((await ctx.sql.query(`SELECT role FROM users WHERE id='user'`))[0].role,'TRUSTED_CONTRIBUTOR');
    assert.equal((await staff.PATCH(request({action:'REJECT',applicationId:id,version:0,note:'Stale review'}))).status,409);
    assert.equal((await staff.PATCH(request({action:'REVOKE',userId:'user',note:'Repeated guidelines violations'}))).status,200);
    assert.equal((await ctx.sql.query(`SELECT role FROM users WHERE id='user'`))[0].role,'USER');
  }finally{await ctx.db.close();}
});
test('comments paginate, normalize replies, keep deleted text private, validate mentions and authorize pins',async()=>{
  const ctx=await setup();try{
    const route=await ctx.route('app/api/posts/[id]/comments/route.ts'),params={params:Promise.resolve({id:'post'})};
    ctx.as('USER','other');const posted=await route.POST(request({body:'Hello @creator, this is useful.'}),params);assert.equal(posted.status,201);const comment=await posted.json();
    const replyResponse=await route.POST(request({body:'A constructive reply.',parentId:comment.id}),params);assert.equal(replyResponse.status,201);const reply=await replyResponse.json();
    const nested=await route.POST(request({body:'Replying to the reply.',parentId:reply.id}),params);assert.equal((await nested.json()).parentId,comment.id);
    const pin=await ctx.route('app/api/posts/[id]/comments/pin/route.ts');assert.equal((await pin.POST(request({commentId:comment.id}),params)).status,403);
    ctx.as('USER');assert.equal((await pin.POST(request({commentId:comment.id}),params)).status,200);
    const list=await(await route.GET(new Request('https://local.test/api'),params)).json();assert.equal(list.comments[0].pinned,true);assert.equal(list.comments.length,1);assert.equal(list.comments[0].replyCount,2);
    ctx.as('USER','other');await route.DELETE(new Request('https://local.test/api?commentId='+comment.id),params);const deleted=await(await route.GET(new Request('https://local.test/api'),params)).json();assert.equal(deleted.comments[0].body,'This comment was deleted.');
    await ctx.db.query(`UPDATE posts SET status='HIDDEN' WHERE id='post'`);assert.deepEqual((await(await route.GET(new Request('https://local.test/api'),params)).json()).comments,[]);
    assert.equal((await ctx.sql.query(`SELECT count(*)::int n FROM notifications WHERE type='MENTION'`))[0].n,1);
  }finally{await ctx.db.close();}
});
