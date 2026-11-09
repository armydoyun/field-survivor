// Shared read-only weapon dimensions and timings; execution and descriptions use these same functions.
export const novaRadius = (s) => (112 + s.nova * 22) * (1 + (s.wavecraft || 0) * .065);
export const mineRadius = (s) => (65 + s.mine * 11);
export const chainTargets = (s) => Math.max(1, s.chain + 1);
export const lanceTargets = (s) => 1 + s.lance;
export const orbitReload = () => 1.25;
export const chainReload = (s) => chainInterval(s.chain) * (1 - (s.conduction || 0) * .055);
export const riftLength = (s) => (195 + s.rift * 24) * (1 + (s.edgecraft || 0) * .065);
export const mineInterval = s => Math.max(2.2, 5.2 - s.mine * .48) * (1 - (s.machinery || 0) * .09);
export const lanceInterval = (s) => Math.max(1.65, 4.2 - s.lance * .36);
export const novaPush = (s) => 32 + (s.repulsion || 0) * 12;
export const riftInterval=s=>Math.max(1.9,4.2-s.rift*.38);
export const beaconShotInterval=s=>Math.max(.8,1.8-s.beacon*.17)*(1-s.machinery*.09);
export const novaInterval = level => Math.max(1.7, 4.2 - level * 0.38);
export const chainInterval = level => Math.max(1.4, 3.7 - level * 0.29);
export const pulseCritChance=s=>s.crit;
export const chainReach=s=>175+s.conduction*18;
export const beaconRange=s=>390+s.placement*25;
export const beaconInterval=s=>Math.max(4.3,8.5-s.beacon*.65);
export const lanceRadius=s=>7+s.wavecraft*1.1;
export const orbitPush=s=>12+s.repulsion*6;
// Specialization phase times, shared by simulation and presentation. Values preserve existing combat.
export const specTiming=Object.freeze({novaExpand:.45,novaHold:.65,novaReturn:.5,chainHop:.065,chainTurn:.12,chainLoop:1.25,lanceStay:1.35,lancePulse:.45,
  mineArm:.35,mineJump:.48,minePressure:2.5,riftAim:.18,riftFold:.36,riftOpen:.2,riftGlow:.16,pulseBurst:.09,pulseAim:.14,pulseRelease:.045,
  orbitOut:.48,beaconAim:.42,beaconFlight:.22,beaconLife:11,beaconPack:.25,beaconDeploy:.3});

export const novaEdgeWidth=7;

// Specialization combat rules; simulation, catalog descriptions and live metrics share these values.
export const specRules=Object.freeze(Object.fromEntries(Object.entries({
  pulse:{side:.38,volleys:3,minRest:.15},
  orbit:{escort:1.25,eccentric:1.05,major:150,minor:48,turn:1.8,guardRadius:76,gap:.55,cap:10000},
  nova:{expand:.85,hold:.35,reflux:.35,return:.65,marked:.95,slow:.2,slowTime:.8},
  chain:{forward:.7,reverse:.45,loop:.3,gap:.4,cap:3,decay:.88},
  lance:{travel:.7,stay:.3,gap:.4,cap:3},
  mine:{cap:8,life:12},
  rift:{side:.8,center:1.4,first:1.2,follow:.9,cuts:3},
  beacon:{shot:1.12,impact:1.5,units:2,shots:4,minRest:.15,relayMove:.6,roverMove:.75,moveSpeed:700}
}).map(([id,rules])=>[id,Object.freeze(rules)])));
export const specRiftWidth=(s,fold=false)=>fold?72+s.wavecraft*4:18+s.wavecraft*2;
export const specBeaconRadius=s=>55+s.wavecraft*4;
export const specBeaconRest=s=>Math.max(specRules.beacon.minRest,beaconShotInterval(s)-(specTiming.beaconAim+specTiming.beaconFlight));
export const specBeaconInterval=s=>specBeaconRest(s)+(specTiming.beaconAim+specTiming.beaconFlight);
