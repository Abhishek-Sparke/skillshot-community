import { canModerateUser, isStaffRole, normalizeRole, permissionsFor, type Permission, type UserRole } from './roles.ts';

export const CASE_STATUSES = ['PENDING','IN_REVIEW','ESCALATED','RESOLVED','DISMISSED'] as const;
export type CaseAction = 'OPEN'|'NOTE'|'ASSIGN'|'ESCALATE'|'KEEP'|'HIDE'|'DELETE'|'DISMISS'|'RESOLVE';
export type CaseActor = {id:string;role:UserRole;permissions:readonly Permission[]};
export function canViewCase(actor:CaseActor,type:string) {
  return isStaffRole(actor.role) && actor.permissions.includes('reports.view') && actor.permissions.includes('moderation.view') &&
    (type==='PROFILE' || actor.permissions.includes(type==='COMMENT'?'comments.view':'skillshots.view'));
}
export function caseActions(actor:CaseActor,type:string,targetRole:unknown='USER',targetId=''): CaseAction[] {
  if(!canViewCase(actor,type)||!actor.permissions.includes('reports.resolve'))return [];
  const actions:CaseAction[]=['OPEN','NOTE','DISMISS','RESOLVE','ESCALATE'];
  if(actor.permissions.includes('team.manage'))actions.push('ASSIGN');
  const profileAllowed=type!=='PROFILE'||(actor.id!==targetId&&canModerateUser(actor.role,normalizeRole(targetRole)));
  if(profileAllowed&&actor.permissions.includes('moderation.approve')&&(type!=='SKILLSHOT'||actor.permissions.includes('skillshots.restore')))actions.push('KEEP');
  if(profileAllowed&&actor.permissions.includes('moderation.hide')&&(type!=='SKILLSHOT'||actor.permissions.includes('skillshots.hide')))actions.push('HIDE');
  if(type==='COMMENT'&&actor.permissions.includes('comments.delete'))actions.push('DELETE');
  if(type==='SKILLSHOT'&&actor.permissions.includes('skillshots.delete'))actions.push('DELETE');
  return actions;
}
export function eligibleReviewer(user:{id:string;role:unknown;status:unknown;custom_permissions?:unknown},type:string,actor?:CaseActor) {
  const role=normalizeRole(user.role);
  if(user.status!=='ACTIVE'||!canViewCase({id:user.id,role,permissions:permissionsFor(role,user.custom_permissions)},type)||!permissionsFor(role,user.custom_permissions).includes('reports.resolve'))return false;
  return !actor || canModerateUser(role,actor.role);
}
export function caseFilters(params:URLSearchParams) {
  const choice=(key:string,choices:readonly string[],fallback:string)=>choices.includes(params.get(key)||'')?params.get(key)!:fallback;
  return {status:choice('status',['ALL',...CASE_STATUSES],'PENDING'),source:choice('source',['ALL','REPORT','AUTO'],'ALL'),type:choice('type',['ALL','SKILLSHOT','IMAGE','COMMENT','REPLY','PROFILE'],'ALL'),mine:params.get('mine')==='1',high:params.get('high')==='1',page:Math.min(10000,Math.max(1,Math.floor(Number(params.get('page'))||1)))};
}
