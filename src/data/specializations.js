import { weaponNames } from './weapons.js';
import { specRules, specTiming as timing } from '../combat/weapon-parameters.js';
const {pulse,orbit,nova,chain,lance,mine,rift,beacon}=specRules;
// A single free, mutually exclusive specialization unlocks at weapon level 3.
const branches = [
  {id:'pulse',name:'PULSE',options:[{id:'tracking',name:'추적 점사',desc:`${pulse.volleys}회 점사 · 사격 사이 ${timing.pulseBurst}초 · 표적 사망 시 재조준 ${timing.pulseAim}초. 발수·관통·치명타 유지.`},{id:'reservoir',name:'장전 고리',desc:`기본 사격 간격 ${pulse.volleys}회분 동안 비축 후 ${pulse.volleys}회 방출. 비축 탄은 접촉·요격하지 않습니다.`}]},
  {id:'orbit',name:'ORBIT',options:[{id:'escort',name:'분리 호위',desc:`위성이 직선 출격 후 귀환합니다. 움직이는 궤도 위치로 귀환 · 출격·귀환 중 요격 중단 · 출격 명중 피해 ×${orbit.escort}.`},{id:'eccentric',name:'편심 궤도',desc:`장반경 ${orbit.major}·단반경 ${orbit.minor} 타원 궤도. 매 바퀴 표적 방향으로 최대 ${orbit.turn}rad/s 회전. 중심 거리 ${orbit.guardRadius} 미만에서 요격, 바깥 구간에서 피해 ×${orbit.eccentric}.`}]},
  {id:'nova',name:'NOVA',options:[{id:'boundary',name:'잔류 파면',desc:`${timing.novaExpand}초 확장 후 경계 ${timing.novaHold}초 유지. 확장 ×${nova.expand}·경계 ×${nova.hold} 피해, 단계별 1회. 내부 지속 피해·회복 없음.`},{id:'reflux',name:'역류 공명',desc:`${timing.novaExpand}초 확장 피해 ×${nova.reflux}·표식, ${timing.novaReturn}초 수축 피해 ×${nova.return} / 표식 대상 ×${nova.marked}. 실제 재접촉 필요 · 회복 없음.`}]},
  {id:'chain',name:'CHAIN',options:[{id:'return',name:'왕복 전류',desc:`${timing.chainHop}초 간격으로 연결 후 좌표를 역순 재공격. 출격 ×${chain.forward}·복귀 ×${chain.reverse} 피해. 복귀는 표적 추적 없이 선분 접촉 판정.`},{id:'circuit',name:'폐회로',desc:`연결 피해 ×${chain.forward} 후 경계 ${timing.chainLoop}초 유지. 선분 접촉 시 첫 피해 ×${chain.loop} · ${chain.gap}초 간격 최대 ${chain.cap}회. 내부 전체 피해 없음.`}]},
  {id:'lance',name:'LANCE',options:[{id:'return',name:'귀환창',desc:`출격 후 현재 플레이어에게 귀환. 출격·귀환 각각 피해 ×${lance.travel}·동일 관통 한도. 회수 전 다음 창 발사 불가.`},{id:'stake',name:'잔류창',desc:`출격 피해 ×${lance.travel} 후 궤적 ${timing.lanceStay}초 유지. ${timing.lancePulse}초마다 피해 ×${lance.stay}·최대 ${lance.cap}회. 회수 전 재발사 불가.`}]},
  {id:'mine',name:'MINE',options:[{id:'pressure',name:'압력식 기뢰',desc:`${timing.mineArm}초 무장 후 적 점유 감지. 마지막 적 이탈 또는 누적 점유 ${timing.minePressure}초에 폭발. 미점유 기뢰는 ${mine.life}초 후 소멸.`},{id:'leap',name:'도약 기뢰',desc:`${timing.mineArm}초 무장 후 적 예상 위치로 도약, ${timing.mineJump}초 뒤 착지 폭발. 도약 후 목적지 고정 · 공중 접촉 피해 없음.`}]},
  {id:'rift',name:'RIFT',options:[{id:'fold',name:'접힘 균열',desc:`${timing.riftAim}초 준비 → 넓은 통로를 ${timing.riftFold}초 동안 압착 → 중심 절단. 양측 각 ×${rift.side}·중심 ×${rift.center}, 대상별 단계당 1회(최대 ×${(rift.side*2+rift.center).toFixed(1)}).`},{id:'trail',name:'추적 균열',desc:`현재 적을 ${timing.riftAim}초 조준한 뒤 긴 관통 균열을 ${rift.cuts}회 연속 절단. 매번 재조준하며 표적 처치 시 주변 적으로 전환. 첫 ×${rift.first}·후속 각 ×${rift.follow}(최대 ×${(rift.first+rift.follow*(rift.cuts-1)).toFixed(1)}). 절단 후 ${timing.riftGlow}초 잔광에는 피해 없음.`}]},
  {id:'beacon',name:'BEACON',options:[{id:'relay',name:'교대 포대',desc:`두 장치가 관측·포격 교대. ${timing.beaconAim}초 관측·${timing.beaconFlight}초 투하 후 범위 피해 ×${beacon.impact}. 포격 지점 고정 · ${timing.beaconLife}초 운용 후 실제 이동 재배치(최소 ${beacon.relayMove}초·최대 이동 속도 ${beacon.moveSpeed}). 이동 중 공격 없음 · 냉각탄·포탑 수 적용 안 됨.`},{id:'rover',name:'유랑 포대',desc:`장치 ${beacon.units}기가 ${beacon.shots}회 사격 후 접기 ${timing.beaconPack}초·이동 최소 ${beacon.roverMove}초(최대 속도 ${beacon.moveSpeed})·재배치 ${timing.beaconDeploy}초. 탄환 피해 ×${beacon.shot} · 이동 중 공격 없음.`}]}
];

for(const b of branches)b.name=weaponNames[b.id];
export { branches };
