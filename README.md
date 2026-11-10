# FIELD SURVIVOR v2.6.27 — SKILL VISUAL DESIGN SOURCE

기본 융합 16종과 상위융합 6종(기반별 16개 제작 경로)을 새 설계로 구현했다. ESM 소스이며 외부 런타임 라이브러리와 번들 파일은 없다.

## 스킬 밸런스 1차 조정

모든 스킬을 같은 조건(단일 표적 · 고정 무리 · 다가오는 무리)에서 측정하고(`npm run bench:skills`), 같은 단계 안의 종합 점수가 중앙값의 0.8~1.4배에 들도록 스킬별 피해 배율(`src/data/balance.js`)을 정했다. 탄막 장벽(F09)과 쇄도하는 지층(F10)은 붙은 적을 맞히지 못하던 위치 문제를 고쳤다. 방법과 스킬별 전후 수치는 [SKILL-BALANCE.md](SKILL-BALANCE.md).

## 서사 재설계 (선택이 결말을 정한다)

신호·기록원·탐사에서 고른 것이 **기억 축**에, 감시자를 돌려보내거나 분해한 것이 **자비 축**에 쌓이고 결말을 정한다. 결말 메뉴는 없다.

- 결말 4개: 남겨진 목소리 · 식지 않는 엔진(빈 껍질 변주) · 두 개의 목소리 · 열린 문(숨은 조건).
- 감시자는 한 판에 3번 나오는 한 인물이다. 쓰러뜨리면 무기를 내리고, 곁에서 3초 멈춰 서면 돌려보내고 E로 분해한다.
- 이번 판의 선택이 중심핵 전투를 바꾼다(방패 · 연결점 · 목소리 공격 · 공격 박자). 결말은 다음 판의 시작 장면으로 이어진다.
- 쓰러진 횟수를 기록원이 기억하고, 결말과 비밀마다 진실 조각이 하나씩 열린다.

설계와 구현 현황은 [NARRATIVE-REDESIGN.md](NARRATIVE-REDESIGN.md), 경로별 측정은 `npm run bench:route`([ROUTE-VALIDATION.json](ROUTE-VALIDATION.json)).

## 그래픽 디자인 업데이트

기본 무기·전문화·융합·상위융합의 색·선·장치·탄환·영역·잔상을 통일했다. 참격은 절단 곡선, 번개는 전류, 기뢰는 무장 하우징으로 구별한다. 불투명한 긴 막대와 반복 잔상 누적을 줄이고, 상위 추가 공격에는 별도 강조색과 기체/포신을 사용한다. 피해 판정과 수치는 그대로다.

[디자인 검토](SKILL-VISUAL-DESIGN.md)와 [Canvas 검토 갤러리](visual-review/index.html)에 전체 대상·시간 흐름·복합 스트레스 장면을 담았다. 개발 패널에서도 갤러리를 열 수 있다. 실제 브라우저 FPS 검증과는 구분한다.

## 플레이와 제작

- 전문화는 원본 무기 Lv3에서 선택한다. 지정 전문화의 **원본 두 개 Lv5**에서 G로 기본 융합을 만든다.
- 기본 융합을 **Lv4**까지 완성하고, 지정한 **제3 원본 무기 Lv5**를 보유하면 상위융합을 만든다. 융합·상위 모두 Lv1로 시작해 Lv4까지 성장한다.
- 상위는 기반 공격의 형태·속도·수량을 유지하며 추가 공격을 병행한다. 기반 Lv4 배율을 계승하고 상위 배율 ×1.20을 한 번 적용한다.
- 순간 참격은 가까운 적의 **현재 위치**를 즉시 타격한다. 플레이어 방향으로 휘두르거나 투사체를 보내지 않는다. 잔상은 별도이며 피해가 없다.
- B 조합 도감에서 재료, 현재 레벨, 선택 경로, 소비 상태, 적용 투자를 확인한다. 제작창은 마지막 상위 경로가 닫히는 선택을 경고한다.
- 선택창·도감·HUD의 원본 무기는 한글명을 공유한다. 선택 카드·도감·재료·HUD는 같은 무기 아이콘/색상을 사용한다.
- 원본 공격체는 융합 시 종료한다. 사용한 원본과 기반 레벨은 기록으로 남지만 재획득·중복 소비·환급은 없다.
- 이전 융합의 레벨/공격은 신규 융합으로 변환하지 않는다. 원본 투자·진행과 과거 발견 횟수는 보존한다.

## 실행과 배포

프로젝트 폴더에서 `python3 -m http.server 8000` 실행 후 `http://localhost:8000/index.html`을 연다. 개발 실험실은 `http://localhost:8000/debug.html?seed=42`다.

배포 entry는 `src/main.js`다. `debug.html`, `src/debug/`, `tests/`, `tools/`, `visual-review/`는 배포에서 제외할 수 있다. 일반 게임의 전이 모듈 111개 중 debug 모듈은 0개다(전체 JS 116개). 번들/minify는 이후 사용자가 적용한다.

## 검증과 한계

`npm test`의 471개 검사가 통과했다. 제작 조건·기존 게임 회귀·32개 경로 실행/표시/저장·고정 표적 30/60/144Hz 피해 비교·상위의 기반 계승·참격·시각 한도 독립성을 검사한다. `npm run test:release`는 debug 디렉터리가 없는 일반 게임의 시작·이동·종료를 검사한다.

`node tools/fusion-benchmark.mjs`는 적 1/30/80/165마리의 128개 시나리오와 상위 전환 전후를 측정해 [FUSION-VALIDATION.json](FUSION-VALIDATION.json)을 갱신한다. 기존 `FUSION-VALIDATION.json`은 v2.6.26의 전투 측정 기록이다. 그래픽 검토는 `visual-review/audit.json`에 별도로 기록했다. 거리180 원형 배치·고정 적·패시브 없음·5초 조건에서 상위의 이전 빌드는 **기반 Lv4 + 추가 전문화 Lv5**다. 이 조건의 16개 상위 경로는 모두 총 피해가 증가했다. 전 방향/이동 적/최대 패시브의 일반적 우위를 의미하지 않는다.

측정 CPU 시간에는 모의 DOM/Canvas가 사용된다. Canvas 래스터에서 전체 스킬·시간 흐름·복합 배치의 가독성을 검토했다. 실제 브라우저 레이아웃·GPU FPS는 검증하지 못했다. 수치는 첫 구현 기준이며 후반 성장 속도·생존 난이도·체감 밸런스의 최종 확정판은 아니다.

상세 동작은 [FUSION-REDESIGN.md](FUSION-REDESIGN.md), 수정 위치는 [DEVELOPMENT.md](DEVELOPMENT.md), 테스트 조작은 [DEBUG-LAB.md](DEBUG-LAB.md)를 참고한다.

## 빌드와 자동 검사 (GitHub Actions)

```bash
npm install          # 처음 한 번 (esbuild · ESLint · Prettier · Playwright)
npm test             # node:test 전체
npm run lint         # ESLint (경고도 실패)
npm run build        # → deploy/index.html
npm run test:build   # 배포본을 Chromium에서 file://로 열어 새 게임을 진행해 봄
```

- `tools/build.mjs`가 esbuild로 `src/main.js`부터 import를 따라 모든 모듈을 묶고 압축한 뒤, `tools/inline-html.mjs`가 `index.html`의 `<link>`·`<script type="module">` 자리에 넣어 한 파일짜리 오프라인 배포본을 만든다. `file://`로 더블클릭해도 열린다. 개발 실험실(`src/debug/`) 모듈이 섞이면 빌드가 실패한다.
- `deploy/`는 빌드 결과라 git에 올리지 않는다.
- 모든 브랜치에 push하면 `.github/workflows/test.yml`이 돈다: **lint**, **test (node)**, **test (browser)**가 따로 돌고, 모두 통과하면 **build**가 배포본을 실행 페이지의 **Artifacts → field-survivor-deploy-<커밋 SHA>**에 올린다.
- 로컬에서 Playwright가 받은 브라우저 대신 이미 설치된 Chromium을 쓰려면 `CHROMIUM_PATH=/경로/chrome npm run test:build`.
