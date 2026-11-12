const enemyType = [
  { hp: 18, speed: 56, radius: 11, gold: 1, xp: 5, contact: 10, color: '#a1b4be', sides: 0 },
  { hp: 12, speed: 103, radius: 9, gold: 2, xp: 7, contact: 8, color: '#e8b78c', sides: 3 },
  { hp: 76, speed: 37, radius: 19, gold: 5, xp: 16, contact: 18, color: '#779bad', sides: 4 },
  { hp: 750, speed: 28, radius: 33, gold: 45, xp: 140, contact: 29, color: '#be8ea5', sides: 6 },
  { hp: 35, speed: 76, radius: 13, gold: 3, xp: 10, contact: 10, color: '#87b9b1', sides: 4 },
  { hp: 52, speed: 62, radius: 14, gold: 4, xp: 13, contact: 16, color: '#d49a86', sides: 3 },
  { hp: 46, speed: 48, radius: 17, gold: 5, xp: 14, contact: 12, color: '#b2c18a', sides: 5 },
  { hp: 30, speed: 98, radius: 10, gold: 4, xp: 12, contact: 10, color: '#a9a2dd', sides: 3 }, // Flanker: lateral windup and crossing dash.
  { hp: 46, speed: 49, radius: 15, gold: 6, xp: 17, contact: 9, color: '#87b9d0', sides: 6 }, // Ward: protects nearby non-boss allies.
  { hp: 38, speed: 57, radius: 13, gold: 5, xp: 15, contact: 11, color: '#d5b5a2', sides: 5 }, // Suppressor.
  { hp: 62, speed: 42, radius: 16, gold: 7, xp: 20, contact: 10, color: '#b4bf78', sides: 4 } // Seeder: temporary, telegraphed ground denial.
];

const eliteTraits = {
  0:{hp:1.9,speed:1.18,name:'가속 추적',text:'0.7초 준비 후 1.2초 동안 추적 속도 1.55배. 재사용 8초.'},
  1:{hp:1.8,speed:1.12,name:'도약',text:'0.9초 착지 예고 후 0.5초 도약. 최대 거리 200, 착지 반경 42·피해 14. 도약 중에도 지면 위치로 피격되며 둔화가 비행 시간을 늘립니다. 재사용 8.5초.'},
  2:{hp:2.2,speed:1.12,name:'파쇄파',text:'1초 예고 후 반경 26→190의 고리 충격파. 폭 16, 열린 각도 72°, 피해 14. 재사용 9.5초.'},
  4:{hp:1.8,speed:1.12,name:'회귀 사격',text:'0.85초 방향 예고 후 기본 속도 205·피해 12의 회귀탄 1발. 0.85초 뒤 반전, 총 수명 1.8초.'},
  5:{hp:2,speed:1.12,name:'잔류 파쇄',text:'돌진 종료 지점에 0.8초 예고 후 반경 26→125 고리 충격파. 폭 16, 열린 각도 72°, 피해 14.'},
  6:{hp:2,speed:1.1,name:'증식',text:'1.1초 준비 후 작은 신속형 최대 2마리 생성. 재사용 11초, 생전 최대 2회. 처치 시 최대 3마리 분열.'},
  7:{hp:1.85,speed:1.16,name:'곡사 기습',text:'직선 돌진 대신 0.9초 예고 후 양쪽으로 휘는 탄환 2발. 기본 속도 200·피해 11, 1초 동안 초당 1.1라디안 회전 후 직진.'},
  8:{hp:2,speed:1.1,name:'잔광 연결',text:'보호 반경 135. 가까운 아군 방향을 고정해 길이 최대 260의 광선. 1.1초 예고·0.9초 유지·폭 20·피해 12. 재사용 10초.'},
  9:{hp:1.9,speed:1.1,name:'회전 광선',text:'1.2초 예고 후 길이 290·폭 20의 광선이 1초 동안 60° 회전. 피해 12. 재사용 10초.'},
  10:{hp:1.8,speed:1.08,name:'교차 포설',text:'0.75초 준비 후 100 간격의 반경 46 구역 최대 2개. 각각 1.3/1.65초 예고·1.8초 유지·피해 12. 재사용 7초.'}
};

const guardianPatterns = ['bloom','fan','charge','sweep','bombard'];

const enemyInfo=[
  ['basic','추적형','플레이어를 향해 접근해 접촉 피해를 줍니다.'],['speedy','신속형','빠르게 추적합니다.'],['tank','중장갑','체력과 접촉 피해가 높은 느린 개체입니다.'],['boss','감시자','방사·조준·돌진·회전 사격·지면 포격을 사용합니다. 전투 경과에 따라 사용 패턴이 늘어납니다.'],
  ['sniper','원거리형','거리 유지 후 0.65초 방향 예고 사격.'],['charger','돌진형','방향 예고 후 직선 돌진. 둔화가 돌진에도 적용됩니다.'],['splitter','분열체','처치 시 작은 신속형 최대 2마리로 분열합니다. 적 수가 가득 차면 분열 수가 줄어듭니다.'],
  ['flanker','기습형','측면으로 선회한 뒤 예고 방향으로 돌진합니다.'],['ward','지원형','반경 105 내 다른 일반 적의 피해 30% 감소, 강화 개체 18% 감소. 보스와 다른 지원형 제외. 중첩되지 않습니다.'],['suppressor','제압형','예고 방향으로 부채꼴 탄환 최대 3발을 발사합니다.'],['seeder','포설자','주황 점선·사선은 예고, 붉은 실선은 활성 구역입니다. 0.55초 준비 후 지면에 1.25초 예고·반경 48·2.1초 공격 구역을 남깁니다. 처치하면 해당 구역이 사라지며 방어 위성은 지면 공격을 막지 못합니다. 이동 중인 표적의 조준 선행 거리는 15~20분에 60에서 현재 이동 속도×총 예고 시간×0.9(최대 420)로 증가하며 준비가 시작되면 좌표를 고정합니다.']
];

export { enemyType, eliteTraits, guardianPatterns, enemyInfo };
