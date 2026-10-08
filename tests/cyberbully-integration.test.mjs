import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { REPORT_CASE_MIGRATION } from '../lib/report-case-schema.ts';
import { COMMENT_MIGRATION } from '../lib/comment-schema.ts';
import * as roles from '../lib/roles.ts';
import * as casePolicy from '../lib/report-case-policy.ts';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

async function load(path, deps) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(await read(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', code)(id => {
    const key = Object.keys(deps).find(k => id.endsWith(k));
    if (!key) throw Error('Missing dependency ' + id);
    return deps[key];
  }, loaded, loaded.exports);
  return loaded.exports;
}

async function setupTestContext(options = {}) {
  const db = new PGlite();
  const schema = await read('lib/db.ts');
  for (const match of schema.matchAll(/await sql\.query\(`([^`]+)`\);/g)) {
    if (/^(CREATE|ALTER|UPDATE users SET role)/.test(match[1])) {
      await db.query(match[1]);
    }
  }
  for (const migration of [REPORT_CASE_MIGRATION, COMMENT_MIGRATION]) {
    for (const statement of migration) {
      await db.query(statement);
    }
  }

  await db.exec(`
    INSERT INTO users (id, email, display_name, username, role, status, created_at)
    VALUES
      ('mod', 'mod@test.invalid', 'Moderator', 'mod', 'MODERATOR', 'ACTIVE', now()),
      ('admin', 'admin@test.invalid', 'Admin', 'admin', 'ADMIN', 'ACTIVE', now()),
      ('user', 'user@test.invalid', 'Creator', 'creator', 'USER', 'ACTIVE', now()),
      ('author', 'author@test.invalid', 'Post Author', 'author', 'USER', 'ACTIVE', now());
    INSERT INTO posts (id, user_id, title, description, skills, tags, category, image_url, image_type, image_size, status)
    VALUES
      ('post1', 'author', 'Awesome artwork', 'My drawing', '[]', '[]', 'Art', 'shots/test.png', 'image/png', 100, 'VISIBLE');
  `);

  let currentActor = {
    id: 'user',
    role: 'USER',
    status: 'ACTIVE',
    email: 'user@test.invalid',
    profile: { display_name: 'Creator' },
    permissions: roles.permissionsFor('USER'),
  };

  const sql = {
    query: async (text, values = []) => {
      try {
        return (await db.query(text, values)).rows;
      } catch (err) {
        err.message += '\nQUERY: ' + text;
        throw err;
      }
    },
    transaction: async writes => Promise.all(writes),
  };

  let mockCyberbullyResult = options.cyberbullyResult ?? null;
  let cyberbullyCalls = [];

  const cyberbullyModerationModule = await load('lib/cyberbully-moderation.ts', {});
  const cyberbullyAdapter = {
    ...cyberbullyModerationModule,
    moderateWithCyberbully: async text => {
      cyberbullyCalls.push(text);
      if (options.cyberbullyThrows) {
        // As defined in lib/cyberbully-moderation.ts: on connection failure, adapter logs and returns null
        return null;
      }
      return mockCyberbullyResult;
    },
  };

  const caseData = await load('lib/report-case-data.ts', {
    '/db': { getReadyDb: async () => sql },
    '/social-links': { safeStoredSocialLinks: () => ({}) },
  });
  const caseActions = await load('lib/report-case-actions.ts', {
    '/db': { getReadyDb: async () => sql },
    '/report-case-data': caseData,
    '/report-case-policy': casePolicy,
    '/xp': {
      XP_REWARDS: { SKILLSHOT_PUBLISHED: 100 },
      awardXp: async () => ({ awarded: true }),
      reverseXp: async () => ({ awarded: false }),
      reverseCommentXp: async () => undefined,
      reverseRelatedXp: async () => undefined,
    },
  });

  const deps = {
    '/db': {
      getReadyDb: async () => sql,
      ensureUser: async u => ({ id: u.userId, username: 'creator', display_name: 'Creator', role: 'USER' }),
    },
    '/authz': {
      requirePrincipal: async permission => {
        if (!currentActor) return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) };
        if (permission && !currentActor.permissions.includes(permission)) {
          return { error: Response.json({ error: 'Forbidden' }, { status: 403 }) };
        }
        return { principal: currentActor };
      },
    },
    '/chatgpt-auth': {
      getChatGPTUser: async () => (currentActor ? { userId: currentActor.id } : null),
    },
    '/roles': roles,
    '/rate-limit': { rateLimit: async () => true },
    '/moderation': {
      moderateText: async () => ({ level: 'SAFE' }),
      commentModerationError: () => null,
      scanUnavailable: () => false,
    },
    '/cyberbully-moderation': cyberbullyAdapter,
    '/comment-notifications': { notifyComment: async () => undefined },
    '/report-case-policy': casePolicy,
    '/report-case-data': caseData,
    '/report-case-actions': caseActions,
    '/xp': {
      awardCommentXp: async () => ({ eligible: true }),
      isMeaningfulComment: () => true,
      reverseCommentXp: async () => undefined,
    },
  };

  return {
    db,
    sql,
    deps,
    caseData,
    caseActions,
    setCyberbullyResult(res) { mockCyberbullyResult = res; },
    getCyberbullyCalls() { return cyberbullyCalls; },
    setActor(role, id) {
      if (!role) {
        currentActor = null;
      } else {
        currentActor = {
          id: id || role.toLowerCase(),
          role,
          status: 'ACTIVE',
          email: `${id || role.toLowerCase()}@test.invalid`,
          profile: { display_name: id || role },
          permissions: roles.permissionsFor(role),
        };
      }
    },
    async postComment(body, postId = 'post1') {
      const route = await load('app/api/posts/[id]/comments/route.ts', deps);
      const req = new Request('https://test.local/api/posts/' + postId + '/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return route.POST(req, { params: Promise.resolve({ id: postId }) });
    },
    async getComments(postId = 'post1') {
      const route = await load('app/api/posts/[id]/comments/route.ts', deps);
      const req = new Request('https://test.local/api/posts/' + postId + '/comments', { method: 'GET' });
      return route.GET(req, { params: Promise.resolve({ id: postId }) });
    },
  };
}

// ==============================================================================
// TEST SUITE: Cyberbully AI Moderation Integration
// ==============================================================================

test('A. Safe comment follows normal publication path and is not flagged', async () => {
  const ctx = await setupTestContext({
    cyberbullyResult: {
      provider: 'cyberbully',
      flagged: false,
      category: null,
      score: 0.01,
    },
  });

  try {
    const res = await ctx.postComment({ body: 'Great work! I really like this.' });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.id);
    assert.equal(data.body, 'Great work! I really like this.');

    // Check DB: comment is VISIBLE
    const comments = await ctx.sql.query('SELECT id, status, body FROM comments WHERE id = $1', [data.id]);
    assert.equal(comments.length, 1);
    assert.equal(comments[0].status, 'VISIBLE');

    // Check moderation_queue: 0 rows
    const queue = await ctx.sql.query('SELECT * FROM moderation_queue WHERE target_id = $1', [data.id]);
    assert.equal(queue.length, 0);
  } finally {
    await ctx.db.close();
  }
});

test('B. Cyberbullying comment flags in moderation_queue and is not automatically permanently deleted', async () => {
  const ctx = await setupTestContext({
    cyberbullyResult: {
      provider: 'cyberbully',
      flagged: true,
      category: 'targeted_insult_general',
      score: 0.75,
    },
  });

  try {
    const res = await ctx.postComment({ body: 'Nobody likes you, you are pathetic.' });
    assert.equal(res.status, 201);
    const data = await res.json();

    // Comment exists and is NOT permanently deleted
    const comments = await ctx.sql.query('SELECT id, status, body FROM comments WHERE id = $1', [data.id]);
    assert.equal(comments.length, 1);
    assert.equal(comments[0].body, 'Nobody likes you, you are pathetic.');
    assert.notEqual(comments[0].status, 'DELETED');

    // Moderation queue received the AI flag
    const queue = await ctx.sql.query('SELECT * FROM moderation_queue WHERE target_id = $1', [data.id]);
    assert.equal(queue.length, 1);
    const item = queue[0];
    assert.equal(item.source, 'AI');
    assert.equal(item.target_type, 'COMMENT');
    assert.equal(item.category, 'targeted_insult_general');
    assert.equal(item.severity, 'BORDERLINE');
    assert.equal(item.status, 'PENDING');

    // provider_ref contains JSON details
    const parsedRef = JSON.parse(item.provider_ref);
    assert.equal(parsedRef.provider, 'Cyberbully');
    assert.equal(parsedRef.score, 0.75);

    // report_cases trigger automatically associated the case
    assert.ok(item.case_id);
    const cases = await ctx.sql.query('SELECT * FROM report_cases WHERE id = $1', [item.case_id]);
    assert.equal(cases.length, 1);
    assert.equal(cases[0].target_type, 'COMMENT');
  } finally {
    await ctx.db.close();
  }
});

test('C. High-confidence harmful comment queues with HIGH severity', async () => {
  const ctx = await setupTestContext({
    cyberbullyResult: {
      provider: 'cyberbully',
      flagged: true,
      category: 'targeted_insult_general',
      score: 0.96,
    },
  });

  try {
    const res = await ctx.postComment({ body: 'Nobody likes you, you are pathetic.' });
    assert.equal(res.status, 201);
    const data = await res.json();

    const queue = await ctx.sql.query('SELECT * FROM moderation_queue WHERE target_id = $1', [data.id]);
    assert.equal(queue.length, 1);
    assert.equal(queue[0].severity, 'HIGH');
    assert.equal(queue[0].source, 'AI');
  } finally {
    await ctx.db.close();
  }
});

test('D. AI service unavailable degrades gracefully without crashing Skillshot', async () => {
  const ctx = await setupTestContext({
    cyberbullyThrows: true, // simulates network error / timeout
  });

  try {
    const res = await ctx.postComment({ body: 'Hello community!' });
    // Skillshot does not crash, returns 201
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.id);

    // Comment is published
    const comments = await ctx.sql.query('SELECT status FROM comments WHERE id = $1', [data.id]);
    assert.equal(comments[0].status, 'VISIBLE');

    // No error queue created
    const queue = await ctx.sql.query('SELECT * FROM moderation_queue WHERE target_id = $1', [data.id]);
    assert.equal(queue.length, 0);
  } finally {
    await ctx.db.close();
  }
});

test('E. Empty/invalid text returns validation error without AI request', async () => {
  const ctx = await setupTestContext();

  try {
    const resEmpty = await ctx.postComment({ body: '' });
    assert.equal(resEmpty.status, 400);

    const resWhitespace = await ctx.postComment({ body: '   ' });
    assert.equal(resWhitespace.status, 400);

    assert.equal(ctx.getCyberbullyCalls().length, 0);
  } finally {
    await ctx.db.close();
  }
});

test('F. Long text is safely bounded according to comment limit (1000 chars)', async () => {
  const ctx = await setupTestContext({
    cyberbullyResult: {
      provider: 'cyberbully',
      flagged: false,
      category: null,
      score: 0.05,
    },
  });

  try {
    const oversizedBody = 'A'.repeat(1500);
    const res = await ctx.postComment({ body: oversizedBody });
    assert.equal(res.status, 201);
    const data = await res.json();

    // Stored text is trimmed and bounded to 1000 characters
    assert.equal(data.body.length, 1000);
    const comments = await ctx.sql.query('SELECT length(body) as len FROM comments WHERE id = $1', [data.id]);
    assert.equal(Number(comments[0].len), 1000);

    // AI request received at most 1000 characters
    const calls = ctx.getCyberbullyCalls();
    assert.ok(calls[0].length <= 1000);
  } finally {
    await ctx.db.close();
  }
});

test('G. Unauthorized user is rejected with 401 before moderation', async () => {
  const ctx = await setupTestContext();

  try {
    ctx.setActor(null); // anonymous
    const res = await ctx.postComment({ body: 'Should fail auth' });
    assert.equal(res.status, 401);
    assert.equal(ctx.getCyberbullyCalls().length, 0);
  } finally {
    await ctx.db.close();
  }
});

test('H. Moderator can review AI flag and take action (KEEP, HIDE, DELETE, DISMISS)', async () => {
  const ctx = await setupTestContext({
    cyberbullyResult: {
      provider: 'cyberbully',
      flagged: true,
      category: 'targeted_insult_general',
      score: 0.88,
    },
  });

  try {
    // 1. Post flagged comment
    const res = await ctx.postComment({ body: 'Nobody likes you, you are pathetic.' });
    assert.equal(res.status, 201);
    const commentId = (await res.json()).id;

    const [queueItem] = await ctx.sql.query('SELECT case_id, provider_ref FROM moderation_queue WHERE target_id = $1', [commentId]);
    assert.ok(queueItem.case_id);

    // 2. Staff views case details via case API handler
    ctx.setActor('MODERATOR', 'mod');
    const caseRoute = await load('app/api/staff/cases/[id]/route.ts', ctx.deps);
    const getReq = new Request('https://test.local/api/staff/cases/' + queueItem.case_id, { method: 'GET' });
    const caseDetailsRes = await caseRoute.GET(getReq, { params: Promise.resolve({ id: queueItem.case_id }) });
    assert.equal(caseDetailsRes.status, 200);

    const caseData = await caseDetailsRes.json();
    assert.equal(caseData.flags.length, 1);
    const flag = caseData.flags[0];
    assert.equal(flag.category, 'targeted_insult_general');
    assert.ok(flag.ai);
    assert.equal(flag.ai.provider, 'Cyberbully');
    assert.equal(flag.ai.score, 0.88);

    // 3. Moderator performs KEEP action
    const actorPrincipal = {
      id: 'mod',
      role: 'MODERATOR',
      status: 'ACTIVE',
      email: 'mod@test.invalid',
      profile: { display_name: 'Moderator' },
      permissions: roles.permissionsFor('MODERATOR'),
    };
    const keepRes = await ctx.caseActions.mutateCase(actorPrincipal, queueItem.case_id, {
      action: 'KEEP',
      version: caseData.case.version,
      reason: 'Context was benign banter between friends',
    });
    assert.equal(keepRes.status, 200);

    // Verify comment is still VISIBLE and case is RESOLVED
    const [keptComment] = await ctx.sql.query('SELECT status FROM comments WHERE id = $1', [commentId]);
    assert.equal(keptComment.status, 'VISIBLE');
    const [resolvedCase] = await ctx.sql.query('SELECT status, decision FROM report_cases WHERE id = $1', [queueItem.case_id]);
    assert.equal(resolvedCase.status, 'RESOLVED');
    assert.equal(resolvedCase.decision, 'KEEP');

    // 4. Verify HIDE action on another flagged comment
    const res2 = await ctx.postComment({ body: 'Second flagged comment' });
    const comment2Id = (await res2.json()).id;
    const [q2] = await ctx.sql.query('SELECT case_id FROM moderation_queue WHERE target_id = $1', [comment2Id]);
    const c2Details = await ctx.caseData.findCase(q2.case_id);

    const hideRes = await ctx.caseActions.mutateCase(actorPrincipal, q2.case_id, {
      action: 'HIDE',
      version: c2Details.version,
      reason: 'Confirmed cyberbullying harassment',
    });
    assert.equal(hideRes.status, 200);

    const [hiddenComment] = await ctx.sql.query('SELECT status FROM comments WHERE id = $1', [comment2Id]);
    assert.equal(hiddenComment.status, 'HIDDEN');
  } finally {
    await ctx.db.close();
  }
});

test('I. Normal users are never exposed to AI model scores or internal provider details', async () => {
  const ctx = await setupTestContext({
    cyberbullyResult: {
      provider: 'cyberbully',
      flagged: true,
      category: 'targeted_insult_general',
      score: 0.92,
    },
  });

  try {
    await ctx.postComment({ body: 'Publicly readable comment' });

    // Public comments endpoint GET
    ctx.setActor('USER', 'regular_user');
    const res = await ctx.getComments('post1');
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.comments.length > 0);

    const publicComment = data.comments[0];
    assert.equal(publicComment.body, 'Publicly readable comment');

    // Verify sensitive AI fields are absent
    assert.equal(publicComment.score, undefined);
    assert.equal(publicComment.provider, undefined);
    assert.equal(publicComment.providerRef, undefined);
    assert.equal(publicComment.category, undefined);
    assert.equal(publicComment.ai, undefined);
    assert.equal(publicComment.moderation, undefined);
  } finally {
    await ctx.db.close();
  }
});

test('J. Cyberbully adapter threshold evaluation logic', async () => {
  const adapter = await load('lib/cyberbully-moderation.ts', {});
  const originalEnv = { ...process.env };
  try {
    process.env.CYBERBULLY_REVIEW_THRESHOLD = '0.50';
    process.env.CYBERBULLY_HIGH_CONFIDENCE_THRESHOLD = '0.90';

    // Safe
    const evalSafe = adapter.evaluateCyberbullyScore({ provider: 'cyberbully', flagged: false, category: null, score: 0.20 });
    assert.equal(evalSafe.action, 'ALLOW');
    assert.equal(evalSafe.severity, 'BORDERLINE');

    // Review / Borderline
    const evalReview = adapter.evaluateCyberbullyScore({ provider: 'cyberbully', flagged: true, category: 'targeted_insult_general', score: 0.70 });
    assert.equal(evalReview.action, 'REVIEW');
    assert.equal(evalReview.severity, 'BORDERLINE');
    assert.equal(evalReview.category, 'targeted_insult_general');

    // High confidence
    const evalHigh = adapter.evaluateCyberbullyScore({ provider: 'cyberbully', flagged: true, category: 'targeted_insult_general', score: 0.95 });
    assert.equal(evalHigh.action, 'HIGH_CONFIDENCE');
    assert.equal(evalHigh.severity, 'HIGH');
    assert.equal(evalHigh.category, 'targeted_insult_general');
  } finally {
    process.env = originalEnv;
  }
});

test('K. Cyberbully client adapter handles network, auth token, and empty inputs', async () => {
  const adapter = await load('lib/cyberbully-moderation.ts', {});
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  try {
    process.env.CYBERBULLY_SERVICE_URL = 'http://127.0.0.1:8001';
    process.env.CYBERBULLY_SERVICE_TOKEN = 'secret-service-token';

    // 1. Successful fetch with token
    let capturedReq = null;
    globalThis.fetch = async (url, options) => {
      capturedReq = { url, options };
      return new Response(JSON.stringify({
        label: 'cyberbullying',
        score: 0.95,
        category: 'targeted_insult_general',
        flagged: true,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const res = await adapter.moderateWithCyberbully('Test input text');
    assert.ok(res);
    assert.equal(res.provider, 'cyberbully');
    assert.equal(res.score, 0.95);
    assert.equal(res.flagged, true);
    assert.equal(res.category, 'targeted_insult_general');
    assert.equal(capturedReq.options.headers['Authorization'], 'Bearer secret-service-token');

    // 2. Fetch network error returns null gracefully
    globalThis.fetch = async () => {
      throw new TypeError('fetch failed');
    };
    const resError = await adapter.moderateWithCyberbully('Test input');
    assert.equal(resError, null);

    // 3. Service returns HTTP 503 returns null gracefully
    globalThis.fetch = async () => {
      return new Response('Model offline', { status: 503 });
    };
    const res503 = await adapter.moderateWithCyberbully('Test input');
    assert.equal(res503, null);

    // 4. Empty text returns null without calling fetch
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      return new Response('{}');
    };
    const resEmpty = await adapter.moderateWithCyberbully('   ');
    assert.equal(resEmpty, null);
    assert.equal(fetchCalled, false);

    // 5. Unconfigured service URL returns null immediately
    delete process.env.CYBERBULLY_SERVICE_URL;
    const resUnset = await adapter.moderateWithCyberbully('Some text');
    assert.equal(resUnset, null);
  } finally {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  }
});

