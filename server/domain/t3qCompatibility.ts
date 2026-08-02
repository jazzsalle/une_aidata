import type { T3qDisasterType } from '../contracts.js';

export const UNE_TO_T3Q_TYPE: Record<string,{disasterType:T3qDisasterType;taxonomyCodes:string[]}> = {
  HEAVY_RAIN:{disasterType:'TYPH',taxonomyCodes:['T10107']},
  TYPHOON:{disasterType:'TYPH',taxonomyCodes:['T10105']},
  FLOOD:{disasterType:'FLOOD',taxonomyCodes:['T10206']},
  INUNDATION:{disasterType:'FLOOD',taxonomyCodes:['T10106']},
  LANDSLIDE:{disasterType:'SLOPE',taxonomyCodes:['T10401']},
};

export function toT3qEventId(input:{date:string;uneEventCode:string;adminCode:string;sequence:number}):string{
  const compactDate=input.date.replace(/[^0-9]/g,'').slice(0,8);
  const mapping=UNE_TO_T3Q_TYPE[input.uneEventCode];
  if(!mapping) throw new Error(`Unsupported UNE event code: ${input.uneEventCode}`);
  if(!/^\d{8}$/.test(compactDate)) throw new Error('date must resolve to YYYYMMDD');
  if(!/^\d{5}$/.test(input.adminCode)) throw new Error('adminCode must be 5 digits');
  if(!Number.isInteger(input.sequence)||input.sequence<1||input.sequence>999) throw new Error('sequence must be 1..999');
  return `EVT::${compactDate}-${mapping.disasterType}-${input.adminCode}-${String(input.sequence).padStart(3,'0')}`;
}

export function taxonomyPrefixMatch(selected:string,candidate:string):boolean{
  return candidate===selected||candidate.startsWith(selected);
}
