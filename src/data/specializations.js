import { weaponNames } from './weapons.js';
import { specRules, specTiming as timing } from '../combat/weapon-parameters.js';
const {pulse,orbit,nova,chain,lance,mine,rift,beacon}=specRules;
// A single free, mutually exclusive specialization unlocks at weapon level 3.
const branches = [
  {id:'pulse',name:'PULSE',options:[
    {id:'tracking',name:'추적 점사',desc:`한 번에 ${pulse.volleys}발을 빠르게 이어 쏩니다(발 사이 ${timing.pulseBurst}초). 표적이 쓰러지면 ${timing.pulseAim}초 뒤 다음 적을 다시 노립니다. 다중 발사 · 관통 · 치명타는 그대로 적용됩니다.`},
    {id:'reservoir',name:'장전 고리',desc:`사격 ${pulse.volleys}번 분량을 모았다가 한꺼번에 ${pulse.volleys}발을 쏩니다. 모아 둔 탄은 적을 맞히거나 적 탄환을 막지 않습니다.`}]},
  {id:'orbit',name:'ORBIT',options:[
    {id:'escort',name:'분리 호위',desc:`위성이 일직선으로 날아가 적을 친 뒤 플레이어 곁의 궤도로 돌아옵니다. 날아갈 때 피해 ×${orbit.escort}. 출격 · 귀환 중에는 적 탄환을 막지 않습니다.`},
    {id:'eccentric',name:'편심 궤도',desc:`위성이 길쭉한 타원(긴 쪽 ${orbit.major} · 짧은 쪽 ${orbit.minor})을 돌며 표적 쪽으로 천천히 방향을 틉니다. 플레이어 가까이(${orbit.guardRadius} 안)에서는 탄환을 막고, 바깥쪽에서는 피해 ×${orbit.eccentric}.`}]},
  {id:'nova',name:'NOVA',options:[
    {id:'boundary',name:'잔류 파면',desc:`충격파가 ${timing.novaExpand}초 동안 퍼진 뒤 가장자리 고리가 ${timing.novaHold}초 남습니다. 퍼질 때 ×${nova.expand}, 고리에 닿을 때 ×${nova.hold} 피해(각각 한 번). 고리 안쪽에는 피해가 없습니다.`},
    {id:'reflux',name:'역류 공명',desc:`충격파가 ${timing.novaExpand}초 동안 퍼지며 ×${nova.reflux} 피해와 표식을 남기고, ${timing.novaReturn}초 동안 되돌아오며 ×${nova.return} 피해(표식이 남은 적은 ×${nova.marked})를 줍니다. 되돌아오는 파면에 실제로 닿아야 합니다.`}]},
  {id:'chain',name:'CHAIN',options:[
    {id:'return',name:'왕복 전류',desc:`번개가 적들을 ${timing.chainHop}초 간격으로 이은 뒤, 같은 길을 거꾸로 되짚어 한 번 더 칩니다. 갈 때 ×${chain.forward}, 돌아올 때 ×${chain.reverse}. 돌아오는 번개는 그 선에 닿은 적만 맞힙니다.`},
    {id:'circuit',name:'폐회로',desc:`번개로 적들을 ×${chain.forward} 피해로 이은 뒤, 그 연결선이 ${timing.chainLoop}초 동안 남습니다. 선에 닿는 적은 ${chain.gap}초마다 ×${chain.loop} 피해(최대 ${chain.cap}번). 선 안쪽 공간에는 피해가 없습니다.`}]},
  {id:'lance',name:'LANCE',options:[
    {id:'return',name:'귀환창',desc:`창이 날아갔다가 플레이어에게 돌아옵니다. 갈 때와 올 때 각각 ×${lance.travel} 피해, 관통 수는 같습니다. 돌아오기 전에는 다음 창을 쏘지 않습니다.`},
    {id:'stake',name:'잔류창',desc:`창이 ×${lance.travel} 피해로 날아간 뒤 지나간 자리가 ${timing.lanceStay}초 동안 남아, ${timing.lancePulse}초마다 ×${lance.stay} 피해를 줍니다(최대 ${lance.cap}번). 자리가 사라지기 전에는 다음 창을 쏘지 않습니다.`}]},
  {id:'mine',name:'MINE',options:[
    {id:'pressure',name:'압력식 기뢰',desc:`설치 ${timing.mineArm}초 뒤부터 위에 올라선 적을 감지합니다. 마지막 적이 떠나거나 적이 모두 합쳐 ${timing.minePressure}초 머물면 터집니다. 아무도 밟지 않으면 ${mine.life}초 뒤 사라집니다.`},
    {id:'leap',name:'도약 기뢰',desc:`설치 ${timing.mineArm}초 뒤 적이 갈 곳을 예상해 뛰어오르고, ${timing.mineJump}초 뒤 내려앉으며 터집니다. 뛴 뒤에는 목적지가 바뀌지 않고, 공중에서는 피해를 주지 않습니다.`}]},
  {id:'rift',name:'RIFT',options:[
    {id:'fold',name:'접힘 균열',desc:`${timing.riftAim}초 준비한 뒤 넓은 통로를 ${timing.riftFold}초 동안 양쪽에서 접고 가운데를 벱니다. 양쪽 각 ×${rift.side}, 가운데 ×${rift.center}(한 적이 모두 맞으면 최대 ×${(rift.side*2+rift.center).toFixed(1)}).`},
    {id:'trail',name:'추적 균열',desc:`적을 ${timing.riftAim}초 조준한 뒤 긴 균열로 ${rift.cuts}번 연달아 벱니다. 벨 때마다 다시 조준하고, 표적이 쓰러지면 가까운 적으로 바꿉니다. 첫 번째 ×${rift.first}, 이후 각 ×${rift.follow}(최대 ×${(rift.first+rift.follow*(rift.cuts-1)).toFixed(1)}). 베고 남는 빛에는 피해가 없습니다.`}]},
  {id:'beacon',name:'BEACON',options:[
    {id:'relay',name:'교대 포대',desc:`포탑 두 대가 번갈아 표적을 관측(${timing.beaconAim}초)하고 포탄을 떨어뜨려(${timing.beaconFlight}초) 범위 피해 ×${beacon.impact}를 줍니다. ${timing.beaconLife}초마다 플레이어 곁으로 옮겨 오며, 옮기는 동안은 쏘지 않습니다. 냉각 탄두 · 포탑 수 증가는 적용되지 않습니다.`},
    {id:'rover',name:'유랑 포대',desc:`포탑 ${beacon.units}대가 ${beacon.shots}발씩 쏜 뒤 접고 자리를 옮겨 다시 펼칩니다(접기 ${timing.beaconPack}초 · 이동 최소 ${beacon.roverMove}초 · 펼치기 ${timing.beaconDeploy}초). 탄환 피해 ×${beacon.shot}, 옮기는 동안은 쏘지 않습니다.`}]}
];

for(const b of branches)b.name=weaponNames[b.id];
export { branches };
