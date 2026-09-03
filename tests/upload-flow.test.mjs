import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';
import * as processing from '../lib/image-processing.ts';
import * as policy from '../lib/upload-policy.ts';
import { imageQuality, imageGeometry, inspectSelectedImage, prepareSelectedImage } from '../lib/image-quality.ts';
import { scanUnavailable, commentModerationError } from '../lib/moderation.ts';

const read = path => readFile(new URL('../'+path, import.meta.url), 'utf8');
const safe = {level:'SAFE'};

test('image recommendations are advisory and preserve every orientation', async () => {
  for (const [width,level] of [[640,'low'],[800,'acceptable'],[1000,'acceptable'],[1200,'great'],[1600,'excellent']]) {
    assert.equal(imageQuality({width,height:480},1024).level,level);
  }
  assert.equal(imageQuality({width:1920,height:1080},2500000).ratio,'16:9');
  assert.equal(imageQuality({width:1080,height:1920},2500000).orientation,'Portrait');
  assert.equal(imageQuality({width:1000,height:1000},1000).orientation,'Square');
  assert.equal(imageQuality({width:400,height:1600},1000).unusual,true);
  const file = new File(['original'],'example.png',{type:'image/png'});
  assert.equal((await prepareSelectedImage(file,{width:640,height:480},'original',0)).file,file,'unedited images must not be recompressed');
  assert.deepEqual(imageGeometry({width:1920,height:1080},'original',90),{sourceWidth:1920,sourceHeight:1080,sourceX:0,sourceY:0,width:1080,height:1920,turn:90});
  assert.equal(imageGeometry({width:1920,height:1080},'square',0).width,1080);
});

test('browser preflight rejects fake MIME, invalid files and over 10 MB', async () => {
  await assert.rejects(inspectSelectedImage(new File(['exe'],'image.jpg',{type:'image/jpeg'})),/not a valid/);
  await assert.rejects(inspectSelectedImage(new File(['image'],'file.gif',{type:'image/gif'})),/Invalid GIF/);
  await assert.rejects(inspectSelectedImage(new File([],'empty.png',{type:'image/png'})),/not a valid/);
  await assert.rejects(inspectSelectedImage(new File([new Uint8Array(policy.SKILLSHOT_MAX_BYTES+1)],'large.png',{type:'image/png'})),/10 MB/);
});

test('rotated phone photos store the displayed orientation for layout', async () => {
  const source=await sharp({create:{width:80,height:120,channels:3,background:'#ff8844'}}).jpeg().withMetadata({orientation:6}).toBuffer();
  const result=await processing.processSkillshot(source,'image/jpeg');
  assert.equal(result.width,120);assert.equal(result.height,80);
  const display=await sharp(result.display).metadata();
  assert.equal(display.width,result.width);assert.equal(display.height,result.height);
});

async function routeHarness({kind='posts',decision=safe,authenticated=true,storageFailure=false,allowed=true,claim=true}={}) {
  const source=await read(kind==='posts'?'app/api/posts/route.ts':'app/api/posts/[id]/comments/route.ts');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const calls=[],puts=[],deletes=[];
  const db={query:async(sql,values=[])=>{
    calls.push({sql,values});
    if(sql.startsWith("UPDATE upload_sessions SET state='PROCESSING'"))return claim?[{pathname:values[0]}]:[];
    if(sql.includes('SELECT id FROM posts'))return [{id:'post'}];
    if(sql.includes('SELECT c.id,c.user_id'))return [{id:'parent',user_id:'other'}];
    if(sql.includes('UPDATE comments'))return [{id:'comment',body:values[0]}];
    if(sql.includes('WITH RECURSIVE thread'))return [{id:'parent'}];
    return [];
  },transaction:async writes=>Promise.all(writes)};
  const require=id=>{
    if(id==='@vercel/blob')return {get:async()=>({statusCode:200,blob:{size:sample.length,contentType:'image/png'},stream:new Blob([sample]).stream()}),put:async(path,bytes,options)=>{if(storageFailure&&puts.length===1)throw Error('offline');puts.push({path,bytes,options});return {pathname:path};},del:async path=>deletes.push(path)};
    if(id.endsWith('/chatgpt-auth'))return {getChatGPTUser:async()=>null};
    if(id.endsWith('/db'))return {getReadyDb:async()=>db,ensureUser:async()=>({display_name:'Creator',username:'creator',role:'USER'})};
    if(id.endsWith('/roles'))return {normalizeRole:()=> 'USER'};
    if(id.endsWith('/comment-notifications'))return {notifyComment:async()=>undefined};
    if(id.endsWith('/authz'))return {requirePrincipal:async()=>authenticated?{principal:{id:'user',email:'user@example.test',profile:{display_name:'Creator'}}}:{error:Response.json({error:'Unauthorized'},{status:401})}};
    if(id.endsWith('/rate-limit'))return {rateLimit:async()=>allowed};
    if(id.endsWith('/moderation'))return {moderateText:async()=>kind==='posts'?safe:decision,moderateImage:async()=>decision,scanUnavailable,commentModerationError};
    if(id.endsWith('/image-processing'))return processing;
    if(id.endsWith('/upload-policy'))return policy;
    if(id.endsWith('/pagination'))return {};
    throw Error('Unexpected dependency '+id);
  };
  const routeModule={exports:{}};
  new Function('require','module','exports',code)(require,routeModule,routeModule.exports);
  return {handler:routeModule.exports,calls,puts,deletes};
}
async function requestImage(bytes,type='image/png') {
  const data=new FormData();data.set('title','Local synthetic test');data.set('image',new File([new Uint8Array(bytes)],'test.png',{type}));
  return new Request('https://local.test/api/posts',{method:'POST',body:data});
}
const sample=await sharp({create:{width:640,height:480,channels:3,background:'#ff8844'}}).png().toBuffer();

test('safe low-resolution upload automatically publishes and creates private display/thumbnail assets', async () => {
  const {handler,calls,puts}=await routeHarness();
  const response=await handler.POST(await requestImage(sample));
  assert.equal(response.status,201);assert.equal((await response.json()).status,'VISIBLE');
  assert.equal(puts.length,3);assert.ok(puts.every(item=>item.options.access==='private'));
  assert.ok(puts.some(item=>item.path.endsWith('thumbnail.webp')));
  assert.equal(calls.find(item=>item.sql.startsWith('INSERT INTO posts')).values[16],'VISIBLE');
  assert.ok(!calls.some(item=>item.sql.includes('INSERT INTO moderation_queue')));
});

test('suspicious uploads are held, high-confidence violations blocked, outages retried', async () => {
  for(const [decision,status,published] of [[{level:'BORDERLINE',category:'sexual'},201,'PENDING_MODERATION'],[{level:'HIGH',category:'sexual/minors'},422,null],[{level:'BORDERLINE',category:'PROVIDER_UNAVAILABLE'},503,null],[{level:'SAFE',category:'AUTOMATED_SCAN_NOT_CONFIGURED'},503,null]]) {
    const {handler,puts,calls}=await routeHarness({decision});
    const response=await handler.POST(await requestImage(sample));
    assert.equal(response.status,status);
    if(published){assert.equal((await response.json()).status,published);assert.ok(calls.some(item=>item.sql.includes('INSERT INTO moderation_queue')));}
    else {assert.equal(puts.length,0);assert.ok(!calls.some(item=>item.sql.includes('INSERT INTO posts')));}
  }
});

test('direct private upload finalization verifies session ownership and removes staged data', async () => {
  const pathname='staging/11111111-2222-3333-4444-555555555555.png';
  for(const claim of [true,false]) {
    const {handler,calls,puts,deletes}=await routeHarness({claim});
    const response=await handler.POST(new Request('https://local.test/api/posts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pathname,title:'Staged synthetic image'})}));
    assert.equal(response.status,claim?201:409);
    const session=calls.find(item=>item.sql.startsWith("UPDATE upload_sessions SET state='PROCESSING'"));
    assert.deepEqual(session.values,[pathname,'user']);assert.match(session.sql,/user_id=\$2/);assert.match(session.sql,/expires_at>now\(\)/);
    if(claim){assert.equal(puts.length,3);assert.ok(deletes.includes(pathname));assert.ok(calls.some(item=>item.sql.includes("state='COMPLETE',post_id=$2")));}
    else {assert.equal(puts.length,0);assert.equal(deletes.length,0);}
  }
});

test('upload endpoint enforces auth, rate, file size, decoded MIME and storage rollback', async () => {
  for(const [options,status] of [[{authenticated:false},401],[{allowed:false},429],[{storageFailure:true},503]]) {
    const {handler,puts,deletes}=await routeHarness(options);
    const response=await handler.POST(await requestImage(sample));assert.equal(response.status,status);
    if(options.storageFailure){assert.equal(deletes.length,1);assert.equal(deletes[0],puts[0].path);}
    else assert.equal(puts.length,0);
  }
  for(const [bytes,type] of [[sample,'image/jpeg'],[Buffer.from('not an image'),'image/png'],[Buffer.alloc(policy.SKILLSHOT_MAX_BYTES+1),'image/png']]) {
    const {handler,puts}=await routeHarness();const response=await handler.POST(await requestImage(bytes,type));
    assert.equal(response.status,400);assert.equal(puts.length,0);
  }
});

test('safe replies publish immediately; unsafe replies and scanner outages do not create approval work', async () => {
  for(const [decision,status] of [[safe,201],[{level:'BORDERLINE',category:'sexual'},422],[{level:'BORDERLINE',category:'PROVIDER_UNAVAILABLE'},503]]) {
    const {handler,calls}=await routeHarness({kind:'comments',decision});
    const response=await handler.POST(new Request('https://local.test/api/posts/post/comments',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({body:'Wonderful work',parentId:'parent'})}),{params:Promise.resolve({id:'post'})});
    assert.equal(response.status,status);assert.ok(!calls.some(item=>item.sql.includes('moderation_queue')));
    const insert=calls.find(item=>item.sql.includes('INSERT INTO comments'));
    if(status===201)assert.equal(insert.values[5],'VISIBLE');else assert.equal(insert,undefined);
  }
});

test('public content displays names while creator profiles retain handles', async () => {
  for(const path of ['app/components/community-feed.tsx','app/components/home-fresh.tsx','app/components/shot-detail.tsx','app/search/page.tsx','app/upload/page.tsx']) {
    const source=await read(path);assert.doesNotMatch(source,/@\{(?:post|row|comment|user|replyTo)\./,path);assert.doesNotMatch(source,/@creator/);
  }
  assert.match(await read('app/components/creator-profile.tsx'),/@\{/);
  const home=await read('app/components/home-fresh.tsx');
  assert.match(home,/ORDER BY p.created_at DESC LIMIT 3/);assert.match(home,/variant=thumbnail/);assert.doesNotMatch(home,/discoveryCard|masonryGrid/);
});

test('homepage renders database image links and an intentional image-free empty state', async () => {
  const source=await read('app/components/home-fresh.tsx');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  for(const rows of [[],Array.from({length:3},(_,i)=>({id:'post-'+i,title:'Real work '+i,display_name:'Creator '+i,username:'handle-'+i,image_width:640,image_height:480,reaction_count:1,comment_count:2,role:'USER'}))]) {
    const routeModule={exports:{}};
    const require=id=>{
      if(id==='react/jsx-runtime')return jsxRuntime;
      if(id==='next/link')return {default:props=>React.createElement('a',props)};
      if(id.endsWith('/db'))return {getReadyDb:async()=>({query:async sql=>{assert.match(sql,/LIMIT 3/);return rows;}})};
      if(id.endsWith('/roles'))return {normalizeRole:()=> 'USER'};
      if(id==='./role-badge')return {default:()=>null};
      throw Error('Unexpected dependency '+id);
    };
    new Function('require','module','exports',code)(require,routeModule,routeModule.exports);
    const html=renderToStaticMarkup(await routeModule.exports.default());
    assert.equal((html.match(/<article/g)||[]).length,rows.length);
    assert.equal((html.match(/<img/g)||[]).length,rows.length);
    if(rows.length){assert.match(html,/post-0\?variant=thumbnail/);assert.match(html,/Creator 0/);assert.doesNotMatch(html,/>@handle-/);}
    else {assert.match(html,/Be the first to share/);assert.match(html,/Create a Skillshot/);}
  }
});
