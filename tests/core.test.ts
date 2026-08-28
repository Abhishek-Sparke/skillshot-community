import assert from 'node:assert/strict';
import test from 'node:test';
import { can, canChangeRole, canModerateUser, normalizeRole, panelForRole, permissionsFor } from '../lib/roles.ts';
import { moderateImage, moderateText } from '../lib/moderation.ts';
import { normalizeSocialUrl } from '../lib/social-links.ts';

test('roles default safely and keep staff boundaries',()=>{
  assert.equal(normalizeRole('member'),'USER');
  assert.equal(normalizeRole('unexpected'),'USER');
  assert.equal(can('MODERATOR','reports.resolve'),true);
  assert.equal(can('MODERATOR','roles.manage'),false);
  assert.equal(can('ADMIN','settings.manage'),false);
  assert.equal(permissionsFor('USER',['users.ban']).length,0);
});

test('head moderator hierarchy is enforced independently of the UI',()=>{
  assert.equal(normalizeRole('head_moderator'),'HEAD_MODERATOR');
  assert.equal(panelForRole('HEAD_MODERATOR'),'/head-mod');
  assert.equal(canChangeRole('HEAD_MODERATOR','USER','MODERATOR'),true);
  assert.equal(canChangeRole('HEAD_MODERATOR','MODERATOR','USER'),true);
  assert.equal(canChangeRole('HEAD_MODERATOR','USER','HEAD_MODERATOR'),false);
  assert.equal(canChangeRole('HEAD_MODERATOR','USER','ADMIN'),false);
  assert.equal(canChangeRole('ADMIN','USER','ADMIN'),false);
  assert.equal(canChangeRole('ADMIN','USER','HEAD_MODERATOR'),true);
  assert.equal(canChangeRole('OWNER','USER','ADMIN'),true);
  assert.equal(canChangeRole('ADMIN','ADMIN','USER'),false);
  assert.equal(canModerateUser('MODERATOR','HEAD_MODERATOR'),false);
  assert.equal(canModerateUser('HEAD_MODERATOR','MODERATOR'),true);
});

test('social profile links normalize scheme-less input and reject wrong hosts',()=>{
  assert.equal(normalizeSocialUrl('github','github.com/example'),'https://github.com/example');
  assert.throws(()=>normalizeSocialUrl('instagram','https://example.com/person'));
  assert.throws(()=>normalizeSocialUrl('linkedin','javascript:alert(1)'));
});

test('fallback moderation blocks high-risk text without blocking ordinary uploads',async()=>{
  assert.equal((await moderateText('A clean interface design')).level,'SAFE');
  assert.equal((await moderateText('credit card dump for sale')).level,'HIGH');
  assert.equal((await moderateImage('https://example.test/image.png')).level,'SAFE');
});
