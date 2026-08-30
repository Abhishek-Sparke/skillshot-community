import assert from 'node:assert/strict';
import test from 'node:test';
import { can, canChangeRole, canModerateUser, normalizeRole, panelForRole, permissionsFor } from '../lib/roles.ts';
import { moderateImage, moderateText } from '../lib/moderation.ts';
import { normalizeSocialUrl } from '../lib/social-links.ts';
import sharp from 'sharp';
import { AVATAR_MAX_BYTES, moderationPreview, processAvatar, processSkillshot, SKILLSHOT_MAX_BYTES, uploadError } from '../lib/image-processing.ts';
import { readBoundedImage, stagingType } from '../lib/upload-policy.ts';
import { managedStoragePath } from '../lib/storage-policy.ts';
import { decodeCursor, encodeCursor, pageSize } from '../lib/pagination.ts';
import { imageDelivery } from '../lib/image-delivery.ts';
import { safeReturnPath, signInPath } from '../lib/auth-path.ts';

test('sign-in links preserve the requested page and reject external redirects', () => {
  assert.equal(safeReturnPath('/shots/abc?view=full#comments'), '/shots/abc?view=full#comments');
  assert.equal(safeReturnPath('//malicious.example'), '/');
  assert.equal(safeReturnPath('https://malicious.example'), '/');
  assert.equal(
    signInPath('/search?q=design#results', 'Sign in to continue'),
    '/signin?callbackUrl=%2Fsearch%3Fq%3Ddesign%23results&reason=Sign+in+to+continue',
  );
});

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

test('fallback moderation blocks high-risk text and holds unscanned images',async()=>{
  assert.equal((await moderateText('A clean interface design')).level,'SAFE');
  assert.equal((await moderateText('credit card dump for sale')).level,'HIGH');
  assert.equal((await moderateImage('https://example.test/image.png')).level,'BORDERLINE');
});

test('storage permissions and cleanup path validation fail closed', () => {
  assert.equal(can('USER', 'storage.manage'), false);
  assert.equal(can('MODERATOR', 'storage.manage'), false);
  assert.equal(can('ADMIN', 'storage.manage'), true);
  assert.equal(managedStoragePath('shots/user/abc/original.png'), true);
  for (const path of ['../secret', 'shots/../secret', 'shots//secret', 'https://example.com/image.png', 'avatars/%2e%2e/a']) assert.equal(managedStoragePath(path), false);
  assert.equal(stagingType('staging/12345678-1234-1234-1234-123456789abc.png'), 'image/png');
  assert.equal(stagingType('shots/user/source.png'), null);
  assert.equal(stagingType('staging/../source.png'), null);
  assert.equal(stagingType(null), null);
  assert.equal(stagingType({ toString: 'invalid' }), null);
});

test('downloads retain original MIME/extension even if a thumbnail variant is requested', () => {
  const row = { image_url: 'original.png', display_url: 'display.webp', thumbnail_url: 'thumbnail.webp', image_type: 'image/png' };
  assert.deepEqual(imageDelivery(row, 'thumbnail', true), { pathname: 'original.png', type: 'image/png', extension: 'png' });
  assert.deepEqual(imageDelivery(row, 'thumbnail', false), { pathname: 'thumbnail.webp', type: 'image/webp', extension: 'webp' });
  assert.equal(imageDelivery({ ...row, thumbnail_url: null }, 'thumbnail', false).pathname, 'display.webp');
  assert.equal(imageDelivery({ ...row, display_url: null, thumbnail_url: null }, 'thumbnail', false).type, 'image/png');
});

test('pagination is bounded and cursors retain same-timestamp ordering', () => {
  assert.equal(pageSize('1000000'), 30);
  assert.equal(pageSize('3.8'), 3);
  assert.equal(pageSize('NaN'), 18);
  assert.equal(pageSize('-1'), 18);
  const cursor = encodeCursor({ created_at: '2026-08-30T00:00:00Z', id: 'shot-b' });
  assert.deepEqual(decodeCursor(cursor), { date: '2026-08-30T00:00:00.000Z', id: 'shot-b' });
  assert.deepEqual(decodeCursor('invalid'), { date: null, id: null });
  assert.deepEqual(decodeCursor('x'.repeat(513)), { date: null, id: null });
});

test('stream readers enforce limits even when source metadata is false', async () => {
  const stream = () => new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(4)); controller.enqueue(new Uint8Array(4)); controller.close(); } });
  assert.equal((await readBoundedImage(stream(), 8)).byteLength, 8);
  await assert.rejects(() => readBoundedImage(stream(), 7), /FILE_TOO_LARGE/);
  await assert.rejects(() => readBoundedImage(new ReadableStream({ start(controller) { controller.close(); } }), 8), /INVALID_IMAGE/);
});

test('valid 1/2 MB avatars and 5/10 MB Skillshots decode and create bounded variants', async () => {
  const png = await sharp({ create: { width: 1024, height: 768, channels: 3, background: '#347891' } }).png().toBuffer();
  for (const size of [1024 * 1024, AVATAR_MAX_BYTES]) {
    const source = Buffer.concat([png, Buffer.alloc(size - png.length)]);
    assert.equal(uploadError(new File([source], 'avatar.png', { type: 'image/png' }), AVATAR_MAX_BYTES), null);
    const avatar = await processAvatar(source, 'image/png');
    const metadata = await sharp(avatar).metadata();
    assert.equal(metadata.width, 512);
    assert.equal(metadata.height, 512);
    assert.ok(avatar.length < AVATAR_MAX_BYTES);
  }
  for (const size of [5 * 1024 * 1024, SKILLSHOT_MAX_BYTES]) {
    const source = Buffer.concat([png, Buffer.alloc(size - png.length)]);
    const processed = await processSkillshot(source, 'image/png');
    const thumbnail = await sharp(processed.thumbnail).metadata();
    assert.ok(thumbnail.width! <= 960 && thumbnail.height! <= 720);
    assert.ok(processed.display.length < size);
  }
  await assert.rejects(() => processAvatar(png, 'image/jpeg'), /MIME_MISMATCH/);
  await assert.rejects(() => processAvatar(Buffer.from('MZ fake executable'), 'image/png'));
  assert.match(await moderationPreview(png, 'image/png'), /^data:image\/webp;base64,/);
});

test('configured moderation outages and invalid responses are held, not published', async t => {
  const saved = { url: process.env.MODERATION_API_URL, key: process.env.MODERATION_API_KEY, strict: process.env.MODERATION_STRICT };
  process.env.MODERATION_API_URL = 'https://scanner.example.test';
  process.env.MODERATION_API_KEY = 'synthetic-test-key';
  process.env.MODERATION_STRICT = 'false';
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 503 }));
  try {
    assert.equal((await moderateImage('data:image/webp;base64,test')).level, 'BORDERLINE');
    fetchMock.mock.mockImplementation(async () => Response.json({ level: 'unexpected' }));
    assert.equal((await moderateImage('data:image/webp;base64,test')).level, 'BORDERLINE');
    fetchMock.mock.mockImplementation(async () => Response.json({ level: 'HIGH', category: 'SAFETY' }));
    assert.equal((await moderateImage('data:image/webp;base64,test')).level, 'HIGH');
    fetchMock.mock.mockImplementation(async () => { throw new Error('network unavailable'); });
    assert.equal((await moderateText('normal text')).level, 'BORDERLINE');
  } finally {
    for (const [key, value] of Object.entries({ MODERATION_API_URL: saved.url, MODERATION_API_KEY: saved.key, MODERATION_STRICT: saved.strict })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('upload limits and decoded image validation are enforced', async () => {
  assert.equal(uploadError(new File([Buffer.alloc(AVATAR_MAX_BYTES)], 'avatar.jpg', { type: 'image/jpeg' }), AVATAR_MAX_BYTES), null);
  assert.equal(uploadError(new File([Buffer.alloc(AVATAR_MAX_BYTES + 1)], 'avatar.jpg', { type: 'image/jpeg' }), AVATAR_MAX_BYTES), 'FILE_TOO_LARGE');
  assert.equal(uploadError(new File([Buffer.alloc(SKILLSHOT_MAX_BYTES)], 'shot.webp', { type: 'image/webp' }), SKILLSHOT_MAX_BYTES), null);
  assert.equal(uploadError(new File([Buffer.alloc(SKILLSHOT_MAX_BYTES + 1)], 'shot.webp', { type: 'image/webp' }), SKILLSHOT_MAX_BYTES), 'FILE_TOO_LARGE');
  assert.equal(uploadError(new File([Buffer.alloc(10)], 'payload.jpg', { type: 'application/octet-stream' }), SKILLSHOT_MAX_BYTES), 'UNSUPPORTED_FORMAT');
  await assert.rejects(() => processSkillshot(Buffer.from('not an image')));
  const source = await sharp({ create: { width: 1600, height: 900, channels: 3, background: '#f45b4f' } }).png().toBuffer();
  const result = await processSkillshot(source);
  assert.equal(result.width, 1600);
  assert.ok(result.thumbnail.length > 0);
  await assert.rejects(() => processSkillshot(source, 'image/jpeg'), /MIME_MISMATCH/);
  const hugeWidth = await sharp({ create: { width: 12_001, height: 1, channels: 3, background: '#000' } }).png().toBuffer();
  await assert.rejects(() => processSkillshot(hugeWidth, 'image/png'), /HUGE_DIMENSIONS/);
});
