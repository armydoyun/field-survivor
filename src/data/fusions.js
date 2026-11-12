// Order is deliberate: validate foundations before higher recipes. Never reuse retired IDs.
export const fusionRequirements=Object.freeze({weapon:5,foundation:4,max:4});
const materials={PT:['pulse','tracking'],PR:['pulse','reservoir'],OE:['orbit','escort'],OX:['orbit','eccentric'],NB:['nova','boundary'],NR:['nova','reflux'],CR:['chain','return'],CC:['chain','circuit'],LR:['lance','return'],LS:['lance','stake'],MP:['mine','pressure'],ML:['mine','leap'],RF:['rift','fold'],RT:['rift','trail'],BR:['beacon','relay'],BV:['beacon','rover']};
const definitions=[
 ['F01','rapid_pulse','초고속 연사포','PT','RT',.10,.055,'중앙탄과 보조탄을 초고속 연사하고 평행 균열을 남깁니다.'],
 ['F02','support_guns','지원 사격대','PT','BR',.18,.075,'플레이어 양옆을 따라다니는 장치 두 기가 서로 다른 적을 사격합니다.'],
 ['F03','shock_mines','충격 지뢰밭','PR','MP',.90,.45,'기뢰 세 개를 짧게 무장시켜 넓은 연쇄 폭발을 일으킵니다.'],
 ['F04','pulse_typhoon','맥동 태풍','PR','NR',.55,.28,'플레이어를 따라 확장·수축하는 파면을 연속 생성합니다.'],
 ['F05','wing_lances','창익 편대','OE','LR',.72,.36,'관통 기체 네 기가 부채꼴로 출격했다가 플레이어에게 돌아옵니다.'],
 ['F06','conductive_guard','도전성 호위망','OE','CC',.20,.12,'주위를 도는 호위점 네 개가 가까운 적 최대 네 명에게 전류를 잇고, 각 전류가 옆의 적 하나로 한 번 더 튑니다.'],
 ['F07','rotating_cutters','회전 절삭대','OX','RF',.60,.30,'긴 회전 날 세 개와 내부 맥동으로 주변을 절삭합니다.'],
 ['F08','meteor_satellites','유성 위성군','OX','ML',.42,.24,'호위 위성 세 개를 두르고, 적 위치에 유성을 반복 투하합니다.'],
 ['F09','bullet_barrier','탄막 장벽','NB','BR',.20,.12,'앞쪽에 늘어선 발사점 네 개가 겨냥한 적에게 탄막을 모으고, 그 앞을 넓은 장벽으로 내리칩니다.'],
 ['F10','surging_strata','쇄도하는 지층','NB','LS',.90,.45,'넓은 지면 전선 세 개가 앞쪽으로 차례차례 솟아오릅니다.'],
 ['F11','reflux_lightning','역류 번개파','NR','CR',.75,.42,'왕복하는 원형 파면이 닿은 적에서 번개를 방출합니다.'],
 ['F12','mobile_transmission','기동 송전대','CR','BV',.32,.18,'이동 전류 장치 두 기가 연속 방전하며 이동 흔적을 남깁니다.'],
 ['F13','distributed_cuts','분산 절단진','CC','RF',1,.55,'서로 떨어진 적 무리 최대 세 곳에 지속 절단진을 생성합니다.'],
 ['F14','leaping_lances','도약 천공대','LR','ML',1,.55,'창 세 개가 차례로 적을 꿰뚫고, 끝에서 폭발한 뒤 돌아옵니다.'],
 ['F15','instant_slash','순간 참격','LS','RT',.16,.08,'가까운 적이 있는 자리를 날아가거나 준비하는 시간 없이 즉시 넓게 벱니다.'],
 ['F16','mobile_mines','이동 기뢰군','MP','BV',.65,.35,'장치 두 기가 다가오는 적 앞으로 기뢰를 하나씩 운반합니다.']
];
const basic=definitions.map(([code,id,name,a,b,interval,floor,desc],i)=>({id:'fs_'+id,code,name,needs:[materials[a],materials[b]],interval,floor,desc,color:['#f7d989','#8fe4c8','#80e3c4','#9de7ff','#ade1ff','#e6ca8f','#d5bdff','#a3dbf6'][i%8]}));
const upper=[
 ['barrage','전장 탄막',.18,.09,[[1,'CC'],[2,'RF'],[9,'PT']],'기반 공격에 좌우 지원점의 고속 관통 사격을 더합니다.'],
 ['storm','이동 뇌우권',.45,.25,[[4,'CC'],[11,'OE']],'기반 파면에 따라다니는 뇌우 중심 두 개와, 가까운 적 세 명에게 떨어지는 번개를 더합니다.'],
 ['fleet','성운 함대',.30,.18,[[5,'ML'],[8,'BR'],[14,'NB']],'기반 공격에 플레이어 주위를 도는 지원 기체 두 기와 중심 충격파를 더합니다.'],
 ['crusher','공전 파쇄장',.35,.20,[[6,'MP'],[7,'CR'],[13,'OE']],'기반 공격을 유지하고 넓은 내부 파쇄장과 최대 세 방향의 외곽 절단을 더합니다.'],
 ['frontline','진격 파쇄전선',.70,.35,[[3,'LS'],[10,'MP'],[16,'NB']],'기반 공격에 두 겹의 넓은 전진 파쇄 전선을 더합니다.'],
 ['thunder_slash','천뢰 참격',.18,.10,[[12,'RT'],[15,'BV']],'기반 공격에 적 위치의 큰 즉시 참격과, 주변 적 두 명에게 튀는 번개를 더합니다.']
];
// Each higher route has a stable ID: parent behavior is unambiguous without mutable provenance.
const higher=upper.flatMap(([group,name,interval,floor,routes,desc],i)=>routes.map(([n,extra])=>{const base=basic.find(b=>b.code==='F'+String(n).padStart(2,'0'));return {id:`hs_${group}_${base.id.slice(3)}`,group:'hs_'+group,code:'H0'+(i+1),name,base:base.id,extra:materials[extra],needs:[...base.needs,materials[extra]],interval,floor,desc,color:base.color};}));
export const fusionRecipes=Object.freeze([...basic,...higher].map(f=>Object.freeze({...f,needs:Object.freeze(f.needs.map(n=>Object.freeze([...n])))})));
export const fusionRules=Object.freeze(Object.fromEntries(fusionRecipes.map(f=>[f.id,Object.freeze({interval:f.interval,floor:f.floor})])));
export const fusionById=Object.freeze(Object.fromEntries(fusionRecipes.map(f=>[f.id,f])));
