export const VERSION = '3.0.0';
export const W = 960, H = 540, ENEMY_LIMIT = 165, DESPAWN_RADIUS = 1120, GEM_KEEP_RADIUS = 1600, GEM_LIMIT = 240, RUN_END = 1800, CORE_SHIELD = .9, CORE_THRESHOLD = .1, FIRST_GUARDIAN = 150, GUARDIAN_SALVAGE = 2, SAVE_KEY = 'field-survivor.v1';
// 이름 있는 감시자는 한 판에 3번, 이 시각 이후 처음 나오는 보스 자리에 나온다. 나머지 보스 자리는 선택 없는 '빈 껍질'이다.
// 쓰러진 감시자는 GUARDIAN_YIELD초 동안 무기를 내리고 기다린다. 반경 GUARDIAN_REACH 안에서 GUARDIAN_STILL초 멈춰 서면 돌려보내고, E로 분해한다.
// 감시자의 시험(v3.0): 이름 있는 감시자를 만난 뒤 이 시간을 버티면 감시자가 먼저 무기를 내린다(만남 순서별 초).
export const GUARDIAN_TRIAL = Object.freeze([75, 90, 100]);
export const GUARDIAN_MEETINGS = [150, 600, 1200], GUARDIAN_YIELD = 12, GUARDIAN_STILL = 3, GUARDIAN_REACH = 120;
export const HARVEST_RATE = 1.2, HARVEST_CAP = 3, HURT_TIME = .65, RECOVERY_DELAY = 3, RECOVERY_FACTOR = .25;
