import assert from 'node:assert/strict';
import test from 'node:test';
import { can, canChangeRole, canModerateUser, normalizeRole, panelForRole, permissionsFor } from '../lib/roles.ts';
import { moderateImage, moderateText } from '../lib/moderation.ts';
import { openAIDecision } from '../lib/openai-moderation.ts';
import { normalizeSocialUrl } from '../lib/social-links.ts';
import sharp from 'sharp';
import { AVATAR_MAX_BYTES, moderationPreview, processAvatar, processSkillshot, SKILLSHOT_MAX_BYTES, uploadError } from '../lib/image-processing.ts';
import { readBoundedImage, stagingType } from '../lib/upload-policy.ts';
import { managedStoragePath } from '../lib/storage-policy.ts';
import { decodeCursor, encodeCursor, pageSize } from '../lib/pagination.ts';
import { imageDelivery } from '../lib/image-delivery.ts';
import { safeReturnPath, signInPath, signUpPath } from '../lib/auth-path.ts';
import { staffLinks, moderationActions, formatBytes } from '../lib/staff-ui.ts';
import { queueFilters } from '../lib/staff-query.ts';
import { publicNavigation } from '../lib/public-navigation.ts';

test('public navigation uses active viewer roles and preserves sign-in return paths', () => {
  const guest = publicNavigation(null, '/shots/example');
  assert.equal(guest.some(link => link.href === '/profile'), false);
  assert.equal(guest.find(link => link.label === 'Sign in')?.href, '/signin?callbackUrl=%2Fshots%2Fexample');
  assert.deepEqual(guest.map(link => link.label), ['Community', 'Search', 'Sign in', 'Sign up']);
  assert.equal(guest.find(link => link.label === 'Sign up')?.href, signUpPath('/profile/edit'));
  for (const role of ['USER', 'TRUSTED_CONTRIBUTOR', 'MODERATOR', 'HEAD_MODERATOR', 'ADMIN', 'OWNER'] as const) {
    const links = publicNavigation({ role, status: 'ACTIVE' }, '/');
    assert.equal(links.some(link => link.href === '/profile'), true);
    assert.equal(links.some(link => link.label === 'Sign in'), false);
    const dashboard = links.find(link => link.label === '◆ Dashboard');
    assert.equal(dashboard?.href, ['USER', 'TRUSTED_CONTRIBUTOR'].includes(role) ? undefined : panelForRole(role));
    assert.equal(publicNavigation({ role, status: 'SUSPENDED' }, '/').some(link => link.label === '◆ Dashboard'), false);
  }
});

test('sign-up paths keep local destinations and reject external or malformed redirects', () => {
  assert.equal(signUpPath(), '/signup?callbackUrl=%2Fprofile%2Fedit');
  assert.equal(signUpPath('/upload'), '/signup?callbackUrl=%2Fupload');
  for (const path of ['https://example.com', '//example.com', '/\\example.com', '/\n/example.com']) {
    assert.equal(safeReturnPath(path), '/');
    assert.equal(signUpPath(path), '/signup?callbackUrl=%2F');
  }
});

test('staff navigation follows role and permission boundaries', () => {
  const links = (role: Parameters<typeof permissionsFor>[0], custom: string[] = []) => staffLinks({id:'staff',username:'staff',role,permissions:permissionsFor(role,custom)});
  assert.equal(links('USER').length,0);
  assert.equal(links('TRUSTED_CONTRIBUTOR').length,0);
  assert.equal(links('OWNER').some(l=>l.label==='Settings'),true);
  assert.equal(links('ADMIN').some(l=>l.label==='Settings'),false);
  assert.equal(links('ADMIN',['settings.manage']).some(l=>l.label==='Settings'),true);
  for(const role of ['HEAD_MODERATOR','MODERATOR'] as const) {
    assert.equal(links(role,['storage.view','settings.manage','users.view']).some(l=>l.href.startsWith('/admin')),false);
  }
  assert.equal(links('HEAD_MODERATOR').some(l=>l.label==='Moderators'),true);
  assert.equal(links('HEAD_MODERATOR').some(l=>l.label==='Moderation History'),true);
  assert.equal(links('MODERATOR').some(l=>l.label==='Moderation History'),false);
  assert.equal(links('MODERATOR',['audit.view']).some(l=>l.href==='/mod/history'),true);
  assert.deepEqual(staffLinks({id:'x',username:'x',role:'MODERATOR',permissions:[]}).map(l=>l.label),['Dashboard']);
});
test('moderation buttons never advertise actions rejected by existing permission checks',()=>{
  assert.deepEqual(moderationActions('PROFILE',permissionsFor('OWNER')),[]);
  assert.deepEqual(moderationActions('SKILLSHOT',[]),[]);
  assert.equal(moderationActions('SKILLSHOT',permissionsFor('MODERATOR')).includes('DELETE'),false);
  assert.equal(moderationActions('COMMENT',permissionsFor('MODERATOR')).includes('DELETE'),true);
  assert.equal(moderationActions('SKILLSHOT',permissionsFor('ADMIN')).includes('DELETE'),true);
});
test('staff query input is bounded and defaults safely',()=>{
  assert.deepEqual(queueFilters(new URLSearchParams()),{type:'ALL',source:'ALL',status:'PENDING',severity:'ALL',reason:'',page:1});
  const filtered=queueFilters(new URLSearchParams({page:'Infinity',reason:'x'.repeat(500),status:'INVALID',type:'PROFILE',source:'REPORT'}));
  assert.equal(filtered.page,10000);assert.equal(filtered.reason.length,100);assert.equal(filtered.status,'PENDING');assert.equal(filtered.type,'PROFILE');
  assert.equal(queueFilters(new URLSearchParams('page=-8')).page,1);
  assert.equal(queueFilters(new URLSearchParams('page=2.8')).page,2);
  assert.equal(formatBytes(1024**3),'1.0 GB');assert.equal(formatBytes(NaN),'0 B');
});

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

function scannerResult(category?: string, score = 0, flagged = false) {
  const names = ['sexual', 'sexual/minors', 'harassment', 'harassment/threatening', 'hate', 'hate/threatening', 'illicit', 'illicit/violent', 'self-harm', 'self-harm/intent', 'self-harm/instructions', 'violence', 'violence/graphic'];
  return { id: 'modr-synthetic', results: [{ flagged, categories: Object.fromEntries(names.map(name => [name, name === category && flagged])), category_scores: Object.fromEntries(names.map(name => [name, name === category ? score : 0])) }] };
}

test('OpenAI moderation maps safe, review, high risk, and invalid results without returning scores', () => {
  assert.equal(openAIDecision(scannerResult()).level, 'SAFE');
  assert.equal(openAIDecision(scannerResult('violence', 0.99, true)).level, 'BORDERLINE');
  assert.equal(openAIDecision(scannerResult('sexual', 0.6)).level, 'BORDERLINE');
  assert.equal(openAIDecision(scannerResult('sexual', 0.99,true)).level, 'HIGH');
  assert.equal(openAIDecision(scannerResult('sexual/minors', 0.99, true)).level, 'HIGH');
  assert.equal(openAIDecision(scannerResult('sexual/minors', 0.9, true)).level, 'BORDERLINE');
  for (const value of [null, {}, { results: [] }, { id: 'x', results: [{ flagged: false, categories: {}, category_scores: {} }] }, scannerResult('sexual', NaN)]) {
    assert.equal(openAIDecision(value).level, 'BORDERLINE');
  }
  assert.deepEqual(Object.keys(openAIDecision(scannerResult())).sort(), ['level', 'providerRef']);
});

test('OpenAI adapter uses the moderation endpoint and holds key, network, and malformed response failures', async t => {
  const keys = ['MODERATION_PROVIDER', 'OPENAI_API_KEY', 'MODERATION_STRICT'];
  const saved = keys.map(key => process.env[key]);
  process.env.MODERATION_PROVIDER = 'openai';
  process.env.OPENAI_API_KEY = 'synthetic-test-key';
  process.env.MODERATION_STRICT = 'false';
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    assert.equal(init?.redirect, 'error');
    assert.ok(init?.signal);
    return Response.json(scannerResult());
  });
  try {
    assert.equal((await moderateText('A clean interface')).level, 'SAFE');
    assert.equal((await moderateImage('data:image/webp;base64,test')).level, 'SAFE');
    assert.equal(requests[0].url, 'https://api.openai.com/v1/moderations');
    assert.deepEqual(requests[0].body, { model: 'omni-moderation-latest', input: 'A clean interface' });
    assert.deepEqual(requests[1].body.input, [{ type: 'image_url', image_url: { url: 'data:image/webp;base64,test' } }]);
    assert.equal((await moderateImage('https://private-blob.example/image')).level, 'BORDERLINE');
    for (const status of [401, 429, 500]) {
      fetchMock.mock.mockImplementation(async () => new Response('', { status }));
      assert.equal((await moderateText('test')).level, 'BORDERLINE');
    }
    fetchMock.mock.mockImplementation(async () => Response.json({}));
    assert.equal((await moderateImage('data:image/webp;base64,test')).level, 'BORDERLINE');
    fetchMock.mock.mockImplementation(async () => { throw new Error('timeout'); });
    assert.equal((await moderateText('test')).level, 'BORDERLINE');
    delete process.env.OPENAI_API_KEY;
    const before = fetchMock.mock.callCount();
    assert.equal((await moderateText('test')).category, 'PROVIDER_NOT_CONFIGURED');
    assert.equal(fetchMock.mock.callCount(), before);
    process.env.MODERATION_PROVIDER = 'typo';
    assert.equal((await moderateImage('test')).level, 'BORDERLINE');
  } finally {
    keys.forEach((key, index) => { if (saved[index] === undefined) delete process.env[key]; else process.env[key] = saved[index]; });
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
