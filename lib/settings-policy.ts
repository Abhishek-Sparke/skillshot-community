export const THEMES = ['light','dark','system'] as const;
export type Theme = typeof THEMES[number];
export const NOTIFICATION_GROUPS = {
  Activity: { likes:'Likes', comments:'Comments', replies:'Replies', mentions:'Mentions', follows:'Follows' },
  Skillshots: { approvals:'Skillshot approvals', moderation:'Moderation updates', featured:'Featured Skillshots', trusted:'Trusted Contributor updates' },
  Community: { announcements:'Community announcements' },
  Email: { emailModeration:'Moderation updates', emailCommunity:'Community updates' },
} as const;
export const NOTIFICATION_KEYS = Object.values(NOTIFICATION_GROUPS).flatMap(group=>Object.keys(group));
export function settingsPatch(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Invalid settings.');
  const value=input as Record<string,unknown>;
  if(Object.keys(value).some(key=>!['theme','notifications'].includes(key))) throw Error('Unsupported setting.');
  if(value.theme!==undefined && !THEMES.includes(value.theme as Theme)) throw Error('Choose Light, Dark, or System.');
  const notifications:Record<string,boolean>={};
  if(value.notifications!==undefined){
    if(!value.notifications || typeof value.notifications!=='object' || Array.isArray(value.notifications))throw Error('Invalid notification preferences.');
    for(const [key,enabled] of Object.entries(value.notifications)) {
      if(!NOTIFICATION_KEYS.includes(key)||typeof enabled!=='boolean')throw Error('Unsupported notification preference.');
      notifications[key]=enabled;
    }
  }
  return {theme:value.theme as Theme|undefined,notifications};
}
