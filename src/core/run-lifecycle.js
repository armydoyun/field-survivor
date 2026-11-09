// Run/profile transitions only. Callers own records, input, screens, feedback and storage.
export function commitRunStart(sessionState,run){
  if(!run)return false;sessionState.replaceRun(run);sessionState.profile.runs++;return true;
}

export function commitRunResult(sessionState,result){
  const r=sessionState.run;if(!r)return null;
  const profile=sessionState.profile,summary=result??{time:r.time,kills:r.kills,gold:r.gold,level:r.level};
  profile.gold+=summary.gold;profile.bestTime=Math.max(profile.bestTime,r.time);profile.bestKills=Math.max(profile.bestKills,r.kills);
  sessionState.replaceRun(null);return summary;
}
