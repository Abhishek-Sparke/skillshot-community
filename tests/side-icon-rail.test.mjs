import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('rolling side rails are no longer mounted on public discovery pages', async () => {
  for (const file of ['app/page.tsx', 'app/community/page.tsx']) {
    const source = await read(file);
    assert.doesNotMatch(source, /SideIconRail|sideIconRail/, file);
  }
});

test('homepage community cards restore green status indicator using database role', async () => {
  const homeFresh = await read('app/components/home-fresh.tsx');
  const roleBadge = await read('app/components/role-badge.tsx');
  const globals = await read('app/globals.css');

  // HomeFresh uses normalized DB role
  assert.match(homeFresh, /<CreatorUsername[^>]+staffRole={normalizeRole\(row\.role\)}/);
  assert.match(homeFresh, /className="authorName"/);

  // RoleBadge maps TRUSTED_CONTRIBUTOR with green indicator
  assert.match(roleBadge, /TRUSTED_CONTRIBUTOR:\s*'Trusted Contributor'/);
  assert.match(globals, /\.roleTRUSTED_CONTRIBUTOR\s*\{\s*color:\s*#278552;\s*background:\s*#e9f8ef;/);

  // Author name and compact badge are aligned
  assert.match(globals, /\.homeFreshMeta\s+\.authorName\s*\{[^}]*display:\s*flex;\s*align-items:\s*center;/);
  assert.match(globals, /\.homeFreshMeta\s+\.authorName\s+\.roleBadge\.compact\s*\{[^}]*width:\s*18px;\s*height:\s*18px;/);
});
