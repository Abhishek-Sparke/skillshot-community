export type TrustedConfig={accountDays:number;posts:number;participation:number;rejectionDays:number;appealDays:number;appealsEnabled:boolean;violationDays:number};
export const ACTIVE_APPLICATIONS=['PENDING','UNDER_REVIEW','MORE_INFO','SUSPENDED'];
export function trustedConfig(value:unknown):TrustedConfig{
  if(!value||typeof value!=='object')throw Error('Invalid configuration.');
  const input=value as Record<string,unknown>;const result:Record<string,unknown>={};
  for(const key of ['accountDays','posts','participation','rejectionDays','appealDays','violationDays']){if(!Number.isInteger(input[key])||Number(input[key])<0||Number(input[key])>3650)throw Error('Use whole numbers from 0 to 3650.');result[key]=input[key];}
  if(typeof input.appealsEnabled!=='boolean')throw Error('Choose whether appeals are enabled.');result.appealsEnabled=input.appealsEnabled;
  return result as TrustedConfig;
}
