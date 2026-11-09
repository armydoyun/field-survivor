# 스킬 개발 — v2.6.25

현재 기본 무기와 전문화 16개만 실행한다. 구 융합 22개는 삭제했으며 신규 융합은 FUSION-REDESIGN.md의 검토안이다. 새 구현을 확정 전 기획에서 정한다.

- 정의: `src/data/upgrades.js`, `src/data/specializations.js`.
- 전투: `src/combat/weapons.js`, `src/combat/specializations.js`.
- 수치: `src/combat/weapon-parameters.js`의 specRules/specTiming.
- 그리기: `src/render/weapons.js`. 실제 타격과 비공격 잔상을 구분한다.
- 저장: `src/save/restore-weapons.js`. 새 상태를 추가하면 검증도 함께 추가한다.
- 시험: debug.html에서 전문화 지급·단독 빌드·적 생성·진행 제어.

융합 카탈로그는 빈 상태로 남겼다. 구 스킬의 계산/공격/렌더링을 복구하거나 기획안을 자동으로 등록하지 않는다. 구 저장의 원본 레벨/전문화는 유지하고 폐기된 융합 레벨·공격 상태는 버린다. 추가 성장권/골드 환급은 없다. 과거 발견 횟수만 이력으로 보존한다.
