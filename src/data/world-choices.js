// Immediate choice values shared by result application and modal descriptions.
export const siteRewards = {
  coordinate:{keep:{gold:100,xp:100},take:{gold:220,xp:240,enemies:[1,1,1,1,1,1]}},
  reservoir:{keep:{heal:40,xp:240},take:{hpCost:25,power:1,enemies:[4,4,4,4,4]}},
  archive:{keep:{gold:350,vitality:1,heal:25},take:{haste:1,xp:350,enemies:[2,5,2,5,2,5],elite:true}}
};
// 경로 간 격차 조정(SKILL-BALANCE.md): 연소(태우기 · 추출)는 즉시 화력, 보존(기억 · 듣기)은 버팀 + 성장(경험치).
export const signalReward = { hp:20, goldBase:70, goldStep:30, burnPower:.08, xp:.06 };
export const witnessReward = { heal:15, gold:150, silenceHeal:40, takeDamage:.05, xp:.06 };
export const anomalyDuration = { clock:90, border:120 };
export const endingReward = 400;
