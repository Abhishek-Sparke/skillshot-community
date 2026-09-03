export const SEARCH_ROLES=['OWNER','ADMIN','HEAD_MODERATOR','MODERATOR','TRUSTED_CONTRIBUTOR'] as const;
export function searchFilters(params:URLSearchParams) {
  const q=(params.get('q')||'').trim().replace(/^@/,'').slice(0,100);
  const words=q.toLowerCase().match(/[\p{L}\p{N}_]+/gu)?.slice(0,8)||[];
  const role=[...new Set((params.get('role')||'').toUpperCase().split(',').filter(r=>SEARCH_ROLES.includes(r as typeof SEARCH_ROLES[number])))];
  const pick=(key:string,values:string[],fallback:string)=>values.includes(params.get(key)||'')?params.get(key)!:fallback;
  return {q,role,category:(params.get('category')||'').trim().slice(0,60),skill:(params.get('skill')||'').trim().slice(0,60),tag:(params.get('tag')||'').trim().slice(0,60),type:pick('type',['all','people','shots'],'all'),sort:pick('sort',['relevance','newest','liked','commented'],q?'relevance':'newest'),page:Math.min(500,Math.max(1,Math.floor(Number(params.get('page'))||1))),suggest:params.get('suggest')==='1',tsquery:words.map(w=>w+':*').join(' & '),prefix:q.toLowerCase().replace(/[\\%_]/g,'\\$&')+'%'};
}
