import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const read = path => readFile(new URL('../'+path, import.meta.url), 'utf8');

test('discovery API performs filtering, ranking and pagination in the database', async () => {
  const source = await read('app/api/posts/route.ts');
  assert.match(source, /ORDER BY CASE WHEN \$9='trending'/);
  assert.match(source, /LIMIT \$10/);
  assert.match(source, /p\.category=\$6/);
  assert.match(source, /follower_id=\$5/);
  assert.match(source, /imageWidth:/);
  assert.match(source, /viewerLiked:/);
});

test('homepage query requests exactly three newest visible Skillshots', async () => {
  const source = await read('app/components/home-fresh.tsx');
  assert.match(source, /status='VISIBLE'/);
  assert.match(source, /ORDER BY p\.created_at DESC LIMIT 3/);
  assert.doesNotMatch(source, /\.slice\(0,\s*3\)/);
});

test('threaded comments use cascading parents and persisted reactions', async () => {
  const schema = await read('lib/db.ts');
  const route = await read('app/api/posts/[id]/comments/route.ts');
  assert.match(schema, /parent_id text REFERENCES comments\(id\) ON DELETE CASCADE/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS comment_reactions/);
  assert.match(route, /parentId/);
  assert.match(route, /notifyComment/);
  assert.match(route, /c\.status='VISIBLE'/);
});

async function reactionRoute(authenticated) {
  const source = await read('app/api/posts/[id]/comments/[commentId]/react/route.ts');
  const code = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const calls=[];
  const routeModule={exports:{}};
  const require=id=>{
    if(id.endsWith('/authz'))return {requirePrincipal:async()=>authenticated?{principal:{id:'user'}}:{error:Response.json({error:'Unauthorized'},{status:401})}};
    if(id.endsWith('/db'))return {getReadyDb:async()=>({query:async(sql,values)=>{calls.push({sql,values});if(/SELECT c.id,c.user_id FROM comments/.test(sql))return [{id:'comment'}];if(/DELETE FROM comment_reactions/.test(sql))return [];return [];}})};
    if(id.endsWith('/rate-limit'))return {rateLimit:async()=>true};
    throw new Error('Unexpected dependency '+id);
  };
  new Function('require','module','exports',code)(require,routeModule,routeModule.exports);
  return {handler:routeModule.exports,calls};
}

test('comment reaction endpoint rejects anonymous access before database use', async () => {
  const {handler,calls}=await reactionRoute(false);
  const response=await handler.POST(new Request('https://local.test'),{params:Promise.resolve({id:'post',commentId:'comment'})});
  assert.equal(response.status,401);
  assert.equal(calls.length,0);
});

test('comment reaction endpoint validates ownership scope and persists a toggle', async () => {
  const {handler,calls}=await reactionRoute(true);
  const response=await handler.POST(new Request('https://local.test'),{params:Promise.resolve({id:'post',commentId:'comment'})});
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{liked:true});
  assert.match(calls[0].sql,/post_id=\$2/);
  assert.match(calls[2].sql,/ON CONFLICT DO NOTHING/);
});

test('viewer and responsive discovery affordances remain keyboard and mobile accessible', async () => {
  const [viewer,css,feed]=await Promise.all([read('app/components/image-viewer.tsx'),read('app/globals.css'),read('app/components/community-feed.tsx')]);
  assert.match(viewer,/Escape/); assert.match(viewer,/ArrowLeft/); assert.match(viewer,/aria-modal="true"/); assert.match(viewer,/event\.key === 'Tab'/);
  assert.match(css,/@media\(max-width:600px\)/); assert.match(css,/columns:1/); assert.match(css,/100dvh/);
  assert.match(css,/\.discoveryCard \.shot\{width:100%;height:auto;min-height:0;/, 'wide images must stay within their card instead of deriving width from a minimum height');
  assert.match(feed,/loading="lazy"/); assert.match(await read('app/components/shot-thumbnail.tsx'),/sizes="/); assert.match(feed,/Following/); assert.match(feed,/categoryFilters/);
});
