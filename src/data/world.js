const signals = [
  { at: 35, title: '신호 01 · 남겨진 목소리', line: '이곳에는 출구가 없다. 그래도 누군가는 다음 사람을 위해 기록을 남겼다.' },
  { at: 235, title: '신호 02 · 이름 없는 사람', line: '이 신호는 적이 아니다. 오래전에 이곳을 지나간 사람이 남긴 문장이다.' },
  { at: 780, title: '신호 03 · 다시 시작하는 이유', line: '시간은 되감기지만, 네가 했던 선택까지 없어지지는 않는다.' }
];

const anomalies = [
  { id: 'clock', at: 300, title: '정지된 초침', line: '초침은 움직이지 않는데 유리 안쪽에서 긁는 소리가 난다.', options: [
    { id: 'hold', name: '멈춤을 간직한다', effect: '90초 동안 12초마다 일반 적 행동 2초 정지 · 이미 발사된 탄환·지면 구역은 지속' },
    { id: 'rush', name: '초침을 부순다', effect: '90초 동안 PULSE 기본 사격 간격 -25%, 적 통상 이동 속도 +12%(돌진 제외)' }] },
  { id: 'border', at: 600, title: '뒤집힌 경계', line: '지도 바깥에 있던 선이 네 발밑을 지나간다. 먼 쪽의 표식들이 하나씩 꺼진다.', options: [
    { id: 'ward', name: '경계를 보호한다', effect: '120초 동안 반경 125의 적 투사체 1개 자동 소거 · 첫 감지 즉시, 이후 16초 재사용' },
    { id: 'harvest', name: '경계를 거둬들인다', effect: '120초 동안 흡수 범위 +90, 처치 보석 기본 EXP +30%, 적 탄속 +20%' }] },
  { id: 'echo', at: 960, title: '돌아온 기록', line: '꺼진 수신기에서 이름들이 들린다. 네가 한 번도 부른 적 없는 이름도 섞여 있다.', options: [
    { id: 'keep', name: '이름을 기억한다', effect: '이번 도전 내내 최대 HP +30, 초당 회복 +0.35' },
    { id: 'erase', name: '기록을 연료로 쓴다', effect: '이번 도전 내내 피해 +18%, 최대 HP -15' }] }
];

// Optional world locations. One reachable site remains until the player investigates it.
const sites = [
  { id: 'coordinate', at: 120, title: '분실된 좌표', line: '표식은 반쯤 묻혀 있다. 흙을 털자 지워진 좌표 아래에서 다른 좌표가 드러난다.', options: [
    { id: 'keep', name: '표식을 복구한다' },
    { id: 'take', name: '핵심을 추출한다' }] },
  { id: 'reservoir', at: 390, title: '닫힌 저장고', line: '문 너머에서 장치가 진동한다. 봉인은 안쪽에서 덧대어져 있다.', options: [
    { id: 'keep', name: '저장 장치를 분리한다' },
    { id: 'take', name: '봉인을 강제로 연다' }] },
  { id: 'archive', at: 720, title: '침묵의 기록고', line: '벌판에 기록함 하나가 남아 있다. 뚜껑에는 손자국이 없는데 안쪽은 따뜻하다.', options: [
    { id: 'keep', name: '기억을 보존한다' },
    { id: 'take', name: '기록을 태운다' }] }
];

// Optional field objectives complement (and never replace) the three legacy relic sites.
const objectives = [
  { id: 'relay', at: 240, name: '붕괴된 중계기', brief: 'E · 접속 / 장치 부근에서 16초 동기화', gold: 140, xp: 200 },
  { id: 'courier', at: 660, name: '떠도는 신호', brief: 'E · 연결 / 이동한 신호 좌표에서 E · 회수', gold: 240, xp: 320 },
  { id: 'hunter', at: 1020, name: '오염된 전달자', brief: 'E · 활성화 / 지정 표적 처치', gold: 360, xp: 440 }
];

// Prior-run decisions materialize as optional, replayable encounters rather than cosmetic dialogue.
const echoes = [
  { id: 'witness', at: 480, name: '돌아온 증언', line: { none: '발신자의 이름이 지워진 기록이 수신기에 걸렸다.', heard: '네가 끝까지 들었던 기록원의 목소리가 전장에 돌아왔다.', taken: '연료로 바꿨던 기록원의 목소리가 빈 파형으로 돌아왔다.' }, keep: '증언을 되돌린다 · 최대 HP +20, 회복 +0.2/s', use: '파형을 분해한다 · 피해 +10%, 최대 HP -10' },
  { id: 'guardian', at: 900, name: '멈춘 감시자의 껍질', line: { none: '발신자의 이름이 지워진 기록이 수신기에 걸렸다.', spared: '돌려보냈던 감시자가 남긴 방어 명령이 다시 들린다.', ended: '분해했던 감시자의 마지막 명령이 부서진 방패에 남아 있다.' }, keep: '방패를 수리한다 · 받는 피해 -15%', use: '껍질을 무기화한다 · 피해 +12%, 최대 HP -12' },
  { id: 'field', at: 1260, name: '버려진 좌표의 응답', line: { none: '발신자의 이름이 지워진 기록이 수신기에 걸렸다.', kept: '이전에 남겨 둔 탐사 표식이 새 좌표를 가리킨다.', taken: '가져갔던 탐사 기록의 빈자리가 다시 나타났다.', rescued: '전에 구조했던 신호가 복귀 경로를 남겼다.', lost: '응답하지 못한 신호가 마지막으로 한 번 더 울린다.' }, keep: '경로를 복원한다 · 흡수 범위 +50', use: '좌표를 연료화한다 · 이동 속도 +10%, 최대 HP -8' }
];

// Three optional front decisions give the middle and final acts distinct tactical stakes.
const fronts = [
  { id: 'breach', at: 540, title: '갈라진 전선', paths: [{ id: 'hold', name: '진형을 유지한다', desc: '받는 피해 -7%, 기본 공격 간격 +5%' }, { id: 'break', name: '돌파를 선택한다', desc: '모든 무기 피해 +10%, 받는 피해 +10%' }] },
  { id: 'legacy', at: 1110, title: '계승하는 기록', paths: [{ id: 'save', name: '기록을 이어받는다', desc: '처치 보석 기본 EXP +14%, 적 통상 이동 속도 +7%(돌진 제외)' }, { id: 'strip', name: '기록을 가속한다', desc: 'PULSE 기본 사격 간격 -9%, 처치 보석 기본 EXP -10%' }] },
  { id: 'threshold', at: 1530, title: '최후의 경계', paths: [{ id: 'shield', name: '경계를 보호한다', desc: '최종 보스 공격 예고 +0.28초, 무기 피해 -6%' }, { id: 'expose', name: '균열을 연다', desc: '중심핵 공격 후 취약 피해 배율 ×1.3→×1.5, 중심핵 공격 피해 +12%' }] }
];

// An ending is not a reset: its consequences can be revisited in the next run.
const legacies = {
  preserve: { name: '남겨진 목소리의 답장', intro: '봉인된 수신기에 문장이 하나 더 생겼다. 서명은 네 것인데, 쓴 기억이 없다.', options: [
    { id: 'share', name: '목소리를 널리 전한다', desc: '흡수 범위 +60 · 초당 회복 +0.2 · 피해 -6%' },
    { id: 'seal', name: '증언을 끝까지 지킨다', desc: '최대 HP +35 · 이동 속도 -6%' }] },
  consume: { name: '식지 않는 엔진의 잔불', intro: '태운 기록에서 지우지 못한 이름들이 떠올랐다. 잿더미 속 연료를 누구에게 돌려줄 것인가?', options: [
    { id: 'rescue', name: '남은 불씨로 상처를 덮는다', desc: '초당 회복 +0.55 · 피해 -12%' },
    { id: 'ignite', name: '엔진에 다시 점화한다', desc: '피해 +18% · 최대 HP -20' }] },
  release: { name: '열린 문 너머의 발자국', intro: '문턱에 발자국이 여럿 겹쳐 있다. 어느 쪽이 바깥으로 향하는지는 분명하지 않다.', options: [
    { id: 'open', name: '통로를 더 넓힌다', desc: '이동 속도 +20% · 받는 피해 +10%' },
    { id: 'anchor', name: '뒤에 남아 길을 지킨다', desc: '최대 HP +25 · 이동 속도 -10%' }] },
  divided: { name: '되풀이되는 두 목소리', intro: '수신기에서 두 목소리가 동시에 말한다. 하나는 기억하라고, 하나는 태우라고.', options: [
    { id: 'listen', name: '두 목소리를 모두 듣는다', desc: '최대 HP +20 · 피해 -5%' },
    { id: 'choose', name: '한 목소리만 고른다', desc: '피해 +10% · 최대 HP -10' }] }
};

// Each field site offers two distinct relics; effects are run-only, discoveries are remembered.
const relics = [
  { id: 'glass', site: 'coordinate', name: '유리 심장', desc: '모든 무기 피해 +35%, 최대 HP -20%' },
  { id: 'harvest', site: 'coordinate', name: '수확의 잔', desc: '경험치 -25%, 획득 EXP 25당 HP 1 회복 · 기본 초당 1.2/순간 3 · 피격 후 3초간 회복 25%' },
  { id: 'mirror', site: 'reservoir', name: '반향 거울', desc: 'ORBIT Lv.1 보장 · 위성이 적 탄환을 막으면 공통 공격력의 80% 반사탄 발사' },
  { id: 'clockwork', site: 'reservoir', name: '멎은 태엽', desc: '피해를 받으면 반경 225의 일반 적을 1.5초 정지 · 14초 재사용 대기 · 이미 발사된 탄환·지면 구역은 지속' },
  { id: 'capacitor', site: 'archive', name: '불안정한 축전기', desc: 'HP가 최대 HP의 40% 이하일 때 PULSE 기본 사격 간격 -30%' },
  { id: 'ember', site: 'archive', name: '잿빛 파편', desc: '처치 수 12의 배수마다 반경 170에 공통 공격력 ×1.4 광역 피해' }
];

// 결말은 경로가 정한다(src/world/route.js). release는 경로 조건 + 마지막 화면에서 멈춤으로만 열린다.
const finalEndings = [{ id: 'preserve', name: '남겨진 목소리' }, { id: 'consume', name: '식지 않는 엔진' }, { id: 'divided', name: '두 개의 목소리' }, { id: 'release', name: '열린 문' }];

// 결말 장면은 도입 + 기록원 + 감시자 + 출구 블록을 조합한다(NARRATIVE-REDESIGN.md 4.3절).
const endingTexts = {
  preserve: { confirm: '마지막 문장을 봉인한다', prompt: '제어판 위에 네가 지키려 한 문장들이 겹쳐 있다.', intro: '장치의 빛은 꺼졌지만 목소리는 남았다. 너는 마지막 문장을 봉인했다. 문은 열리지 않았고, 너는 그 문장 옆에 남기로 했다.', tail: '문장 옆에 이름을 적을 자리가 남았다.' },
  consume: { confirm: '모든 기록을 엔진에 넣는다', prompt: '제어판이 뜨겁다. 네가 태운 기록들이 아직 그 안에서 타고 있다.', intro: '엔진이 문을 밀어 올렸다. 따뜻한 공기가 먼저 나갔고, 너는 빈 기록함을 지나 뒤따랐다. 발음할 수 없는 이름 하나가 입안에 남았다.', tail: '불빛은 그 자리를 지나 엔진으로 흘렀다.' },
  divided: { confirm: '아무것도 정하지 않고 손을 뗀다', prompt: '제어판 위에서 지킨 문장과 태운 문장이 반쯤씩 겹쳐 있다.', intro: '너는 제어판에서 손을 뗐다. 엔진은 잠시 멈췄다가, 다시 돌기 시작했다. 어느 쪽도 고르지 않은 기록은 다음 반복의 첫 줄이 된다.', tail: '엔진은 다음 사람을 기다린다. 아마 너를.' },
  release: { confirm: '', prompt: '', intro: '접속이 끊기자 엔진이 멎었다. 문이 열렸다. 감시자와 기록원이 네 뒤를 따랐다. 처음으로, 되감기지 않는 발소리였다.', tail: '이제 그 길을 닫으라는 명령은 도착하지 않는다.' },
  hollow: { intro: '엔진이 문을 밀어 올렸다. 뒤를 돌아봤지만 따라오는 소리는 없었다. 벌판에는 이름 하나 남지 않았다.' }
};

const endingScenes = {
  witness: {
    release: '기록원이 수신기를 내려놓았다. "네가 서 있던 시간을 셌어. 이제 그걸로 충분해." 그는 처음으로 문 쪽으로 걸었다.',
    heard: { preserve: '기록원은 봉인된 문장 옆에 남았다. 네가 들어 준 이야기가 맨 위에 적혀 있다.', consume: '기록원의 목소리는 끝까지 들렸다. 엔진이 그것마저 삼키기 전까지는.', divided: '기록원이 말했다. "다음에는 조금 더 오래 서 있어 줘."' },
    taken: '기록원의 목소리는 이제 엔진의 소음 속에서만 들린다. 네가 추출한 파형이 그 안에서 돌고 있다.',
    hollow: '기록원은 어디에도 없다. 수신기만 빈 원 안에 남았다.',
    none: '길가의 기록원은 끝내 말을 걸지 않았다. 수신기의 불빛만 너를 따라왔다.'
  },
  guardian: {
    release: '감시자가 처음으로 이름을 말했다. 너는 그 이름을 들은 마지막 사람이 아니게 되었다.',
    spared: '돌려보낸 감시자가 방패를 내렸다. 방패 안쪽에 사람이 지나갈 틈이 생겼다.',
    ended: '빈 껍질들이 같은 방향으로 돌아섰다. 네가 분해한 명령이 그들을 움직인다.',
    hollow: '껍질들은 더 이상 아무 명령도 기다리지 않는다.',
    mixed: '돌려보낸 껍질과 분해한 껍질이 나란히 섰다. 어느 쪽도 너를 막지 않았다.',
    none: '감시자의 명령은 아무 이름도 덧붙이지 않은 채 반복된다.'
  },
  exit: {
    release: '분실된 좌표가 문 위치와 겹쳤다. 출구는 처음부터 거기 있었다.',
    keep: '복구한 좌표가 벌판 끝을 가리킨다. 아직 누구도 그 끝까지 걸어가지 않았다.',
    take: '좌표의 핵심은 네 주머니에 있다. 그것이 어디를 가리켰는지는 이제 아무도 모른다.',
    none: '분실된 좌표는 끝내 흙 속에 남았다.',
    silence: '지나친 표식 {count}개가 아직 깜박인다.'
  }
};

const episodeKinds = ['relay','gates','hunt'];

// 감시자는 한 존재다. 돌려보낸 횟수(모든 판 누적)에 따라 말을 되찾는다. 6회 이상이면 이름을 말한다.
const guardianLines = {
  name: '이안',
  arrival: [
    { from: 0, line: '감시자가 나타났다. 커다란 원 안에서 또 하나의 소리가 난다.' },
    { from: 1, line: '감시자가 다시 나타났다. 방패 안쪽에서 짧은 신호가 두 번 울린다.' },
    { from: 3, line: '감시자가 나타났다. "…또 너구나." 껍질 안에서 갈라진 목소리가 났다.' },
    { from: 6, line: '감시자가 나타났다. "나는 이안이었어. 네가 그걸 기억하게 해 줬지."' }
  ],
  ended: '감시자가 나타났다. 이전에 부순 껍질의 흔적이 남아 있다.',
  hollow: '이름 없는 껍질이 나타났다. 안쪽에서는 아무 소리도 나지 않는다.',
  yieldLine: '감시자가 무기를 내렸다. 가만히 서 있으면 돌려보내고, E로 분해한다.',
  spare: '감시자 · 네가 멈춰 있는 동안 껍질이 닫혔다. 그는 등을 돌려 돌아갔다.',
  end: '감시자 · 껍질 안쪽까지 분해했다. 끊어진 명령이 한 번 더 점멸했다.',
  leave: '감시자 · 기다리던 껍질이 스스로 물러났다. 아무 선택도 남지 않았다.'
};

// 중심핵 전투에서 이번 판의 선택이 돌아올 때 남는 기록.
const coreLines = {
  shields: '돌려보낸 감시자의 방패가 네 옆에 섰다.',
  shells: '분해한 감시자의 껍질이 연결점이 되어 중심핵을 감쌌다.',
  blocked: '감시자가 방패로 중심핵의 공격을 막았다. 남은 방패 {left}.',
  heard: '기억한 목소리들이 상처를 덮었다.',
  witness: '기록원이 중심핵 곁에서 공격 신호를 먼저 읽어 준다.',
  taken: '중심핵 안에서 기록원의 목소리가 들린다. 네가 추출한 파형이다.',
  voice: '태운 신호들이 중심핵의 목소리가 되어 겹겹이 퍼진다.'
};

export { signals, anomalies, sites, objectives, echoes, fronts, legacies, relics, finalEndings, endingTexts, endingScenes, guardianLines, coreLines, episodeKinds };
