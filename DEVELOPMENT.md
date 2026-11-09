# 수정 지도 — v2.6.27

새 융합은 등록 데이터, 패시브 수치, 공격 생성, 이동·충돌, 시각 표시, 저장 복원을 분리한다. 새 효과의 변경 위치는 아래 표로 찾는다.

| 작업 | 파일 |
| --- | --- |
| 게임 조립 | `src/app/create-game.js`, `src/main.js` |
| 프레임 진행 | `src/app/loop.js`, `src/app/update.js` |
| 화면별 허용 행동 | `src/core/view-policy.js` |
| 판 시작·종료·정산 | `src/core/session.js`, `src/core/run-lifecycle.js` |
| 기본 상태·영구 기록 | `src/core/run.js`, `src/core/profile.js` |
| 계산·난이도 | `src/core/statistics.js`, `src/core/difficulty.js` |
| 난수 | `src/core/random.js` |
| 기본 무기·전문화 | `src/combat/weapons.js`, `src/combat/specializations.js` |
| 공유 수치·상태·공격 폐기 | `src/combat/weapon-parameters.js`, `src/combat/attack-state.js`, `src/combat/loadout.js` |
| 적·충돌·체력·사망 | `src/app/enemies.js`, `src/combat/collisions.js`, `src/combat/health.js`, `src/combat/death.js` |
| 성장 확정·후보 | `src/growth/commands.js`, `src/growth/progression.js`, `src/growth/cards.js` |
| 전문화 데이터 | `src/data/specializations.js`, `src/data/upgrades.js` |
| 융합 이름·재료·주기·계보 추가 | `src/data/fusions.js` |
| 한글 무기 이름·아이콘·공통 표기 | `src/data/weapons.js`, `src/ui/weapon-label.js` |
| 융합 피해·패시브·주기 하한 | `src/combat/fusion-parameters.js` |
| 융합 고정 시간 진행·전체 탄환 예산 | `src/combat/fusions.js` |
| 연사·지원 사격·장벽 생성 | `src/combat/fusions/basic-guns.js` |
| 기뢰·파면·전선·절단진·즉시 참격 생성 | `src/combat/fusions/basic-fields.js` |
| 편대·회전 날·호위·송전 장치 동작 | `src/combat/fusions/basic-mobile.js` |
| 상위 추가 모듈 6종 | `src/combat/fusions/higher.js` |
| 탄환/창 이동·기뢰/파면/영역 타격 | `src/combat/fusions/effects.js` |
| 융합 도형·타격 기록·표적·시각 잔상 | `src/combat/fusions/context.js` |
| 융합 상태 생성·저장 검증 | `src/combat/fusion-record.js`, `src/save/restore-fusions.js` |
| 공통 스킬 색·형태·윤곽·면색 | `src/render/skill-style.js` |
| 융합 그림만 수정 | `src/render/fusions.js` |
| 저장 입출력·복원 | `src/core/storage.js`, `src/save/format.js`, `src/save/restore-run.js`, `src/save/restore-weapons.js` |
| 구 융합 발견 이력 ID 허용 목록 | `src/save/retired-fusions.js` |
| 렌더링·피드백 | `src/render/scene.js`, `src/render/weapons.js`, `src/render/feedback.js` |
| 도감·표시 모델 | `src/ui/build-guide.js`, `src/ui/build-model.js`, `src/ui/growth-metrics.js`, `src/ui/hud-model.js` |
| 입력·화면 | `src/input/keyboard.js`, `src/ui/screen.js`, `src/app/actions.js` |
| 개발 실험실 | `src/debug/create-debug-game.js`, `src/debug/commands.js`, `src/debug/panel.js` |

## 검사

`npm test`는 현재 기능의 검사만 실행한다. 제거한 스킬의 실행/렌더링 회귀 검사와 그 기능을 전제한 과거 전체 실행 비교기는 함께 폐기했다. 이전 수치와 동작이 모두 같다고 주장하지 않는다. 원본 키보드 비교는 `tests/input-original.mjs`, 기본 무기 원본 데이터는 `tests/baseline-base-catalog.json`, 전문화 고정 회귀는 `tests/specialization-parameters.test.js`로 유지한다.

핵심 검사: `tests/architecture.test.js`, `tests/boundaries.test.js`, `tests/freeze.test.js`, `tests/lifecycle.test.js`, `tests/save.test.js`, `tests/growth.test.js`, `tests/enemy-systems.test.js`, `tests/world-decisions.test.js`, `tests/debug-lab.test.js`, `tests/view-policy.test.js`, `tests/release.test.js`, `tests/fusion-retirement.test.js`, `tests/fusion-redesign.test.js`.

## 변경 흐름

1. 새 기본 융합은 데이터에 별도 `fs_` ID로 등록하고 해당 `basic-*.js`의 작은 핸들러를 추가한다. 기존 전문화 코드를 융합에 복제하지 않는다.
2. 공격을 생성할 때 `fusionParameters`의 보정 스냅샷을 보관한다. 실제 피해는 `combat.damage`를 거쳐 사망/보상/보스 선택을 한 번만 처리한다.
3. 새 공격 도형은 `effects.js`의 판정, `render/fusions.js`의 표시, `save/restore-fusions.js`의 허용 스키마를 함께 추가한다. 잔상은 `visuals`에만 두며 저장하지 않는다.
4. 상위는 `hs_계보_기반ID`를 사용한다. 데이터의 `base`가 기반 실행과 재료를 고정하므로 별도의 가변 기반 레벨 스냅샷은 필요 없다. 기반은 항상 Lv4다.
5. 제작 조건을 바꾸면 `fusionRequirements`, 성장 후보 비용, 조합 도감 문구/모델 및 경계 테스트를 함께 확인한다.

`tools/fusion-benchmark.mjs`는 개발 도구이며 일반 entry에 포함되지 않는다. 난이도 감독의 융합 전투력은 추정치이며 실측 DPS로 표시하지 않는다.

그래픽의 기준과 전체 점검 기록은 `SKILL-VISUAL-DESIGN.md`에 있다. `tests/skill-design.test.js`는 56개 전체 게임 저장 해시를 v2.6.26과 비교한다.
