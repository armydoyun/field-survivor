// Save envelope stays v:1; runtime visual caches are never persisted.
export const SAVE_VERSION = 1;
export function encodeSave(profile,run){
  const snapshot=run&&(({fx,popups,arcs,waves,...saved})=>saved)(run);
  if(snapshot)snapshot.fusionStates=Object.fromEntries(Object.entries(snapshot.fusionStates||{}).map(([id,{visuals,...state}])=>[id,state]));
  return JSON.stringify({v:SAVE_VERSION,profile,run:snapshot});
}
export function readSave(text){const data=JSON.parse(text);return data&&data.v===SAVE_VERSION&&data.profile?data:null;}
