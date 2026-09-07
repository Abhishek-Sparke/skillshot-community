import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { REPORT_CASE_MIGRATION } from '../lib/report-case-schema.ts';
import * as policy from '../lib/report-case-policy.ts';
import * as roles from '../lib/roles.ts';

const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
async function load(path,dependencies) {
  const code=ts.transpileModule(await source(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const loaded={exports:{}};
  new Function('require','module','exports',code)(id=>{const key=Object.keys(dependencies).find(key=>id.endsWith(key));if(!key)throw Error('Unexpected dependency '+id);return dependencies[key];},loaded,loaded.exports);
  return loaded.exports;
}
const principal=(role='ADMIN',id='admin')=>({id,role,status:'ACTIVE',email:id+'@test.invalid',permissions:roles.permissionsFor(role),profile:{}});
async function database() {
  const db=new PGlite();
  await db.exec(`CREATE TABLE users(id text PRIMARY KEY,username text UNIQUE,display_name text,bio text,location text,skills jsonb DEFAULT '[]',website text,social_links jsonb,role text,status text DEFAULT 'ACTIVE',custom_permissions jsonb DEFAULT '[]',avatar_url text,avatar_type text,created_at timestamptz DEFAULT now());
    CREATE TABLE posts(id text PRIMARY KEY,user_id text REFERENCES users(id),title text,description text,category text,skills jsonb,status text DEFAULT 'VISIBLE',image_url text,display_url text,thumbnail_url text,image_type text,image_width integer,image_height integer,created_at timestamptz DEFAULT now(),deleted_at timestamptz);
    CREATE TABLE comments(id text PRIMARY KEY,user_id text REFERENCES users(id),post_id text REFERENCES posts(id),parent_id text REFERENCES comments(id),body text,status text DEFAULT 'VISIBLE',created_at timestamptz DEFAULT now());
    CREATE TABLE reports(id text PRIMARY KEY,reporter_id text REFERENCES users(id),target_type text,target_id text,category text,details text DEFAULT '',status text DEFAULT 'PENDING',created_at timestamptz DEFAULT now(),resolved_at timestamptz,resolved_by text REFERENCES users(id),UNIQUE(reporter_id,target_type,target_id));
    CREATE TABLE moderation_queue(id text PRIMARY KEY,source text,target_type text,target_id text,creator_id text REFERENCES users(id),category text,severity text,status text DEFAULT 'PENDING',created_at timestamptz DEFAULT now(),reviewed_at timestamptz,reviewed_by text REFERENCES users(id));
    CREATE TABLE audit_logs(id text PRIMARY KEY,actor_id text REFERENCES users(id),action text,target_type text,target_id text,metadata jsonb DEFAULT '{}',created_at timestamptz DEFAULT now());
    CREATE TABLE notifications(id text PRIMARY KEY,user_id text REFERENCES users(id),type text,title text,body text);
    CREATE TABLE storage_cleanup_queue(id text PRIMARY KEY,post_id text,pathname text,reason text,cleanup_after timestamptz,deleted_at timestamptz);
    INSERT INTO users(id,username,display_name,role) VALUES('admin','admin','Admin','ADMIN'),('owner','owner','Owner','OWNER'),('head','head','Head','HEAD_MODERATOR'),('mod','mod','Moderator','MODERATOR'),('creator','creator','Creator','USER'),('reporter','reporter','Reporter','USER'),('reporter2','reporter2','Reporter Two','USER');
    INSERT INTO posts(id,user_id,title,image_url,display_url,thumbnail_url,image_type)VALUES('shot','creator','Actual work','shots/original.png','shots/display.webp','shots/thumb.webp','image/png');
    INSERT INTO comments(id,user_id,post_id,body)VALUES('parent','creator','shot','Parent context');
    INSERT INTO comments(id,user_id,post_id,parent_id,body)VALUES('reply','reporter','shot','parent','Reported reply');
    INSERT INTO reports(id,reporter_id,target_type,target_id,category)VALUES('legacy','reporter','PROFILE','creator','OTHER');
    INSERT INTO moderation_queue(id,source,target_type,target_id,creator_id,category,severity)VALUES('legacyq','REPORT','PROFILE','creator','creator','OTHER','BORDERLINE');`);
  try {await db.transaction(async tx=>{for(const statement of REPORT_CASE_MIGRATION)await tx.query(statement);});}catch(error){await db.close();throw error;}
  const sql={query:async(text,values)=> (await db.query(text,values)).rows};
  const data=await load('lib/report-case-data.ts',{'/db':{getReadyDb:async()=>sql},'/social-links':{safeStoredSocialLinks:()=>({})}});
  const actions=await load('lib/report-case-actions.ts',{'/db':{getReadyDb:async()=>sql},'/report-case-data':data,'/report-case-policy':policy,'/xp':{XP_REWARDS:{SKILLSHOT_PUBLISHED:100},awardXp:async()=>({awarded:true}),reverseXp:async()=>({awarded:false}),reverseCommentXp:async()=>undefined,reverseRelatedXp:async()=>undefined}});
  return {db,sql,data,actions};
}
async function report(db,id='report1',reporter='reporter',type='SKILLSHOT',target='shot') {
  await db.query(`INSERT INTO reports(id,reporter_id,target_type,target_id,category)VALUES($1,$2,$3,$4,'VIOLENCE')`,[id,reporter,type,target]);
  return (await db.query(`SELECT c.* FROM report_cases c JOIN reports r ON r.case_id=c.id WHERE r.id=$1`,[id])).rows[0];
}

test('case migration is repeatable, preserves legacy profile reports and groups multiple reports',async()=>{
  const {db}=await database();try{
    const legacy=(await db.query(`SELECT case_id FROM reports WHERE id='legacy'`)).rows[0];assert.ok(legacy.case_id);
    const first=await report(db);const second=await report(db,'report2','reporter2');assert.equal(first.id,second.id);
    await db.transaction(async tx=>{for(const statement of REPORT_CASE_MIGRATION)await tx.query(statement);});
    assert.equal((await db.query(`SELECT count(*)::int n FROM report_cases WHERE target_type='SKILLSHOT'`)).rows[0].n,1);
    assert.equal((await db.query(`SELECT count(*)::int n FROM report_case_events WHERE action='REPORT_CREATED' AND case_id=$1`,[first.id])).rows[0].n,2);
  }finally{await db.close();}
});

test('open, assign, note, escalate and keep are atomic, versioned and audited in PostgreSQL',async()=>{
  const {db,actions,data}=await database();try{
    let item=await report(db);
    const act=async(action,extra={},actor=principal())=>{const response=await actions.mutateCase(actor,item.id,{action,version:item.version,...extra});const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));item=await data.findCase(item.id);return result;};
    await act('OPEN');assert.equal(item.status,'IN_REVIEW');assert.equal(item.reviewer_id,'admin');
    await act('ASSIGN',{assignedTo:'mod'});assert.equal(item.assigned_to,'mod');
    await act('NOTE',{reason:'Private internal note'});
    await act('ESCALATE',{assignedTo:'head',reason:'Needs a second opinion'},principal('MODERATOR','mod'));assert.equal(item.status,'ESCALATED');
    await act('KEEP',{reason:'Context allowed'});assert.equal(item.status,'RESOLVED');
    assert.equal((await db.query(`SELECT status FROM posts WHERE id='shot'`)).rows[0].status,'VISIBLE');
    assert.equal((await db.query(`SELECT status FROM reports WHERE id='report1'`)).rows[0].status,'RESOLVED');
    assert.equal((await db.query(`SELECT count(*)::int n FROM audit_logs WHERE metadata->>'caseId'=$1`,[item.id])).rows[0].n,6);
    const duplicate=await actions.mutateCase(principal(),item.id,{action:'DELETE',version:item.version,reason:'Duplicate'});assert.equal(duplicate.status,409);
    const sameCase=await report(db,'report2','reporter2');assert.equal(sameCase.id,item.id);assert.equal(sameCase.status,'PENDING');
  }finally{await db.close();}
});

test('hide, dismiss, deletion retention and stale decisions behave correctly',async()=>{
  const {db,actions,data}=await database();try{
    let item=await report(db);const stale=item.version;
    assert.equal((await actions.mutateCase(principal(),item.id,{action:'HIDE',version:item.version,reason:'Policy violation'})).status,200);
    assert.equal((await db.query(`SELECT status FROM posts WHERE id='shot'`)).rows[0].status,'HIDDEN');
    assert.equal((await actions.mutateCase(principal(),item.id,{action:'KEEP',version:stale})).status,409);
    item=await report(db,'report2','reporter2');
    assert.equal((await actions.mutateCase(principal(),item.id,{action:'DISMISS',version:item.version})).status,200);
    assert.equal((await db.query(`SELECT status FROM posts WHERE id='shot'`)).rows[0].status,'HIDDEN');
    await db.query(`UPDATE report_cases SET status='PENDING' WHERE id=$1`,[item.id]);item=await data.findCase(item.id);
    assert.equal((await actions.mutateCase(principal(),item.id,{action:'DELETE',version:item.version,reason:'NSFW'})).status,200);
    const cleanup=await db.query(`SELECT count(*)::int n FROM storage_cleanup_queue WHERE cleanup_after>now()+interval '29 days'`);assert.equal(cleanup.rows[0].n,3);
    await db.query(`UPDATE posts SET status='PURGED' WHERE id='shot'`);await db.query(`UPDATE report_cases SET status='PENDING' WHERE id=$1`,[item.id]);item=await data.findCase(item.id);
    assert.equal((await actions.mutateCase(principal(),item.id,{action:'KEEP',version:item.version})).status,409);
    assert.equal((await data.findCase(item.id)).status,'PENDING');
  }finally{await db.close();}
});

test('profile visibility is separate from account access and reply context uses exact parent',async()=>{
  const {db,actions,data}=await database();try{
    let item=await data.findCase('legacy');
    assert.equal((await actions.mutateCase(principal(),item.id,{action:'HIDE',version:item.version,reason:'Bio review'})).status,200);
    const profile=(await db.query(`SELECT status,profile_status FROM users WHERE id='creator'`)).rows[0];assert.equal(profile.status,'ACTIVE');assert.equal(profile.profile_status,'HIDDEN');
    item=await report(db,'comment-report','reporter2','COMMENT','reply');
    const content=await data.caseContent('COMMENT','reply');assert.equal(content.comment.body,'Reported reply');assert.equal(content.context[0].body,'Parent context');assert.equal(content.post.id,'shot');
    assert.equal((await actions.mutateCase(principal('MODERATOR','mod'),item.id,{action:'DELETE',version:item.version,reason:'Harassment'})).status,200);
    assert.equal((await db.query(`SELECT status FROM comments WHERE id='reply'`)).rows[0].status,'DELETED');
  }finally{await db.close();}
});

test('case policies protect normal users, permissions, staff hierarchy and assignment',()=>{
  for(const role of ['USER','TRUSTED_CONTRIBUTOR'])assert.deepEqual(policy.caseActions(principal(role),'SKILLSHOT'),[]);
  const mod=principal('MODERATOR','mod');assert.equal(policy.caseActions(mod,'SKILLSHOT').includes('DELETE'),false);assert.equal(policy.caseActions(mod,'PROFILE','ADMIN','admin').includes('HIDE'),false);assert.equal(policy.caseActions(mod,'SKILLSHOT').includes('ASSIGN'),false);
  assert.equal(policy.eligibleReviewer({id:'mod2',role:'MODERATOR',status:'ACTIVE'},'SKILLSHOT',mod),false);
  assert.equal(policy.eligibleReviewer({id:'head',role:'HEAD_MODERATOR',status:'ACTIVE'},'SKILLSHOT',mod),true);
  assert.equal(policy.eligibleReviewer({id:'head',role:'HEAD_MODERATOR',status:'SUSPENDED'},'SKILLSHOT'),false);
});
