import assert from 'node:assert/strict';
import test from 'node:test';
import { can, normalizeRole, permissionsFor } from '../lib/roles.ts';
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
