import assert from 'node:assert/strict';
import { normalizeAidreamcapesTemplateFilter as normalize, templateMatchesFilters, aidreamcapesFilterJsonLd } from '../src/lib/aidreamcapes-template-filter.ts';
let checks = 0;
function check(path, query, expected) {
  const state = normalize(path, query);
  for (const [key, value] of Object.entries(expected)) assert.deepEqual(state[key], value, `${path} ${key}`);
  if (state.redirectPath) {
    const url = new URL(state.redirectPath, 'https://www.aivideosugc.com');
    const next = Object.fromEntries([...new Set(url.searchParams.keys())].map(key => [key, url.searchParams.getAll(key).length === 1 ? url.searchParams.get(key) : url.searchParams.getAll(key)]));
    assert.equal(normalize(url.pathname, next).redirectPath, undefined, 'no redirect loop');
  }
  checks++;
}
check('/templates', {}, { canonicalPath: '/templates', noindex: false });
check('/templates', { kind: 'photo' }, { redirectPath: '/templates/photo', canonicalPath: '/templates/photo' });
check('/templates', { type: 'video' }, { redirectPath: '/templates/video' });
check('/templates', { type: 'photo', industries: '/industries/shoes' }, { redirectPath: '/templates/photo?industries=%2Findustries%2Fshoes', noindex: true });
check('/templates', { kind: 'photo', utm_source: 'newsletter' }, { redirectPath: '/templates/photo?utm_source=newsletter', canonicalPath: '/templates/photo' });
check('/templates/photo', { kind: 'video' }, { redirectPath: '/templates/photo', filters: {kind:'photo'} });
check('/templates/photo', { platforms: '/platforms/youtube-shorts-ads' }, { noindex: true, canonicalPath: '/templates/photo?platforms=%2Fplatforms%2Fyoutube-shorts-ads' });
check('/templates', { kind: ['photo', 'video'] }, { invalid: true, noindex: true });
check('/templates', { industries: 'https://other.example/' }, { invalid: true, redirectPath: undefined });
check('/templates', { industries: '/industries/unknown' }, { noindex: true });
check('/templates', { kind: 'invalid' }, { invalid: true, redirectPath: undefined });
check('/templates/photo', { utm_source: 'ad' }, { noindex: false, canonicalPath: '/templates/photo', redirectPath: undefined });
check('/templates', { kind: '', industries: '' }, { noindex: false });
assert.equal(templateMatchesFilters({kind:'photo',industries:['/industries/shoes'],platforms:[],occasions:[]}, {kind:'video'}), false);checks++;
const nodes = [{'@id':'https://www.aivideosugc.com/templates#webpage', url:'https://www.aivideosugc.com/templates', parent:'https://www.aivideosugc.com/industries'}];
const rewritten = aidreamcapesFilterJsonLd(nodes, '/templates', {industries:'/industries/shoes'});
assert(rewritten[0].url.includes('?industries='));assert.equal(rewritten[0].parent,nodes[0].parent);assert.equal(nodes[0].url,'https://www.aivideosugc.com/templates');checks++;
console.log(JSON.stringify({ok:true,checks,writes:false},null,2));
