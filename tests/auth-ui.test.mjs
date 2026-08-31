import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import * as paths from '../lib/auth-path.ts';
import * as navigation from '../lib/public-navigation.ts';

// Execute the real server components/actions with isolated session/provider adapters.
// These tests never log in/out a real user or contact Google.
async function component(file, { principal = null, session = null } = {}) {
  const calls = [];
  const source = await readFile(new URL(`../app/components/${file}.tsx`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const loaded = { exports: {} };
  const require = id => {
    if (id === 'react/jsx-runtime') return jsx;
    if (id === 'next/link') return { default: 'a' };
    if (id === 'next/navigation') return { redirect: destination => { throw new Error(`redirect:${destination}`); } };
    if (id.endsWith('/authz')) return { getPrincipal: async () => principal };
    if (id.endsWith('/auth')) return {
      auth: async () => session,
      signIn: async (...args) => { calls.push(['signIn', ...args]); },
      signOut: async (...args) => { calls.push(['signOut', ...args]); },
    };
    if (id.endsWith('/auth-path')) return paths;
    if (id.endsWith('/public-navigation')) return navigation;
    if (id.endsWith('/auth-submit-button')) return { default: 'SubmitButton' };
    if (id.endsWith('/responsive-navbar')) return { default: 'Navbar' };
    if (id.endsWith('.css')) return {};
    throw new Error(`Unexpected component dependency: ${id}`);
  };
  new Function('require', 'module', 'exports', code)(require, loaded, loaded.exports);
  return { render: loaded.exports.default, calls };
}

function elements(tree, type) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(item => elements(item, type));
  return [...(tree.type === type ? [tree] : []), ...elements(tree.props?.children, type)];
}

test('public navbar exposes a logout server action only to authenticated viewers', async () => {
  const guest = await component('public-navbar');
  assert.equal(elements(await guest.render({ returnTo: '/' }), 'form').length, 0);
  for (const status of ['ACTIVE', 'SUSPENDED']) {
    const member = await component('public-navbar', { principal: { role: 'USER', status } });
    const forms = elements(await member.render({ returnTo: '/' }), 'form');
    assert.equal(forms.length, 1);
    assert.equal(typeof forms[0].props.action, 'function');
    await forms[0].props.action();
    assert.deepEqual(member.calls, [['signOut', { redirectTo: '/' }]]);
  }
});

test('sign-in and sign-up use the same Google provider and preserve the intended destination', async () => {
  for (const mode of ['signin', 'signup']) {
    const screen = await component('auth-screen');
    const tree = await screen.render({ mode, params: { callbackUrl: '/upload' } });
    const forms = elements(tree, 'form');
    assert.equal(forms.length, 1);
    await forms[0].props.action();
    assert.deepEqual(screen.calls, [['signIn', 'google', { redirectTo: '/upload' }]]);
    const links = elements(tree, 'a').map(item => item.props.href);
    assert.ok(links.includes('/signin?callbackUrl=%2Fupload'));
    assert.ok(links.includes('/signup?callbackUrl=%2Fupload'));
  }
});

test('new registrations default to profile setup and redirect destinations fail safely', async () => {
  for (const [params, expected] of [[{}, '/profile/edit'], [{ callbackUrl: '//example.com' }, '/'], [{ callbackUrl: '/signin' }, '/']]) {
    const screen = await component('auth-screen');
    const tree = await screen.render({ mode: 'signup', params });
    await elements(tree, 'form')[0].props.action();
    assert.deepEqual(screen.calls, [['signIn', 'google', { redirectTo: expected }]]);
  }
  const signedIn = await component('auth-screen', { session: { user: { email: 'test@example.test' } } });
  await assert.rejects(signedIn.render({ mode: 'signin', params: { callbackUrl: '/community' } }), /redirect:\/community/);
  assert.equal(signedIn.calls.length, 0);
});
