> 이 문서는 이전 버전의 구조 변경 기록이다. v2.6.25에서 구 융합 구현/렌더링을 제거했다. 현재 상태는 README.md와 DEVELOPMENT.md를 우선한다.

# 화면별 행동 허용 정책 — v2.6.24

첫 수정 위치는 **`src/core/view-policy.js`**다. 화면 모드와 오버레이 상태를 읽어 행동 허용 여부만 반환하는 함수 18개를 둔다. 세션·DOM·저장소·키 이벤트를 참조하거나 상태를 변경하지 않는다. 새 화면을 추가할 때 관련 행동의 정책과 검사 조합을 함께 검토한다.

## 정책과 호출 위치

| 행동 | 정책 | 호출 위치 |
| --- | --- | --- |
| 일반 게임 업데이트 | `canSimulate` | `app/loop.js` |
| 장면/카메라 그리기 | `canRenderScene` | 같은 파일 |
| HUD 주기 갱신 | `canRefreshHud` | 같은 파일 |
| 자동 저장 | `canAutoSave` | 같은 파일 |
| 디버그 정지/한 단계/배속 진행과 판정 표시 | `canControlLiveCombat` | `debug/combat-inspector.js`, `debug/commands.js` |
| 세계 상호작용 | `canInteractInWorld` | `app/actions.js`, `input/keyboard.js`, `world/story.js`, `sites.js`, `objectives.js`, `encounters.js` |
| 이동 키 수용 | `canAcceptMovement` | `input/keyboard.js` |
| 실행 중 일시정지/자동 일시정지 | `canPauseGame` | `core/session.js`, `app/events.js`, `ui/menu-input.js` |
| 일시정지/재개 단축키 | `canTogglePause` | `input/keyboard.js` |
| 융합 화면 열기 | `canOpenFusion` | `ui/growth-actions.js` |
| 융합 버튼의 모드상 활성 표시 | `fusionButtonEnabled` | `ui/hud-model.js` |
| 성장 재추첨 | `canRerollUpgrade` | `ui/growth-actions.js` |
| 업그레이드 상세 열기 | `canOpenUpgradeInfo` | `ui/build-guide.js`, `input/keyboard.js` |
| 도감 열기/닫기 | `canToggleBuildGuide` | `ui/build-guide.js` |
| 상점 열기/닫기 | `canToggleShop` | `ui/shop.js` |
| S 단축키의 상점 열기 | `canOpenShopWithKeyboard` | `input/keyboard.js` |
| 영구 강화 구매/구매 가능 표시 | `canBuyPermanentUpgrade` | `ui/shop.js` |
| 기록 초기화 확정 | `canResetRecords` | `core/session.js` |

동일한 조건을 쓰는 행동도 의미가 다르면 별도 이름을 유지한다. 이동과 상호작용을 같은 정책으로 묶지 않으며, 장면 렌더링도 업데이트와 별도 함수로 둔다. 현재 렌더링의 기본 허용 조건은 업데이트 정책을 재사용한다. 별도 정책 객체 생성기·동적 액션 등록·FSM·이벤트 버스는 없다.

## 기존의 차이를 유지한 부분

- 일반 업데이트/렌더링은 playing 모드에서 프라이버시·도감·상점을 제외한다. 디버그 진행/표시는 여기에 상세 설명창도 제외한다. 이번 변경으로 원래 조건을 넓히거나 좁히지 않았다.
- 주기적 HUD 갱신은 기존처럼 프라이버시 플래그 자체를 검사하지 않는다. 자동 저장은 run 존재와 프라이버시까지 검사한다. 저장 시각 도래 후 다음 시각을 미루는 기존 순서도 유지한다.
- 수동 저장·Ctrl/Cmd+S·pagehide/visibilitychange 저장에는 자동 저장 정책을 적용하지 않는다. 이들은 기존 입력/이벤트 우선순위를 유지한다.
- 상점 버튼은 playing에서도 열 수 있지만 S 단축키는 menu/paused/ending/gameover에서만 열 수 있다. 구매는 menu에서만 가능하다.
- 융합 버튼 표시는 run과 모드를 기준으로 한다. 실제 열기에는 오버레이/프라이버시 조건이 추가로 필요하다. 융합 닫기는 열기 정책보다 먼저 처리하여 원래 복귀 동작을 유지한다.
- 세계 상호작용 정책은 기존의 playing 모드 조건이다. 프라이버시·오버레이와 키 이벤트의 우선순위는 키보드 라우터가 먼저 처리한다. 거리·발생 여부·잔여 선택 같은 도메인 조건은 각 세계 모듈에 남는다.
- F9의 최우선 처리, IME/수정 키/연타/텍스트 입력 처리, 포커스 복원, 선택 화면의 명령 라우팅, `resumeMode`의 재개 우선순위는 기존 담당자가 맡는다. 모든 `view.mode` 비교를 정책 함수로 바꾸지는 않는다.
- 프레임의 업데이트 이후 화면이 바뀔 수 있으므로 렌더링/HUD/저장은 그 시점에 다시 판단한다. 프레임 시작의 허용 결과를 재사용하지 않는다.

이 정책은 기존 행동을 모은 호환성 경계이며 잘못된 상태 조합을 자동 교정하는 검증기나 보안 경계가 아니다. 향후 조건 변경은 의도적인 동작 변경으로 검토하고 검사를 갱신한다.

## 검사

전체 자동 검사 403개 통과. `tests/view-policy.test.js`의 새 검사 23개는 다음을 포함한다.

- 기존 23개 모드 + 미지정 모드 1개, 오버레이/프라이버시 플래그 16조합, run 3상태, 열기/닫기 2상태 = 정책당 2,304조합. 18개 정책의 총 41,472판정을 이전 호출부의 독립된 조건식과 비교한다. 입력은 동결하고 결과가 boolean인지도 확인한다.
- 모든 공개 정책의 검사 누락과 모달에 새로 추가한 화면의 조합 검사 누락을 확인한다.
- 실제 루프의 업데이트·렌더링·HUD·자동 저장 호출을 1,152상태에서 확인한다. 업데이트 중 선택 화면으로 전환되면 이후 렌더링/저장이 중단되는지도 확인한다.
- 수동 저장의 우선순위, 세계 상호작용 도중 화면 전환 후 처리 중단, 융합의 열기 거절/복귀 우선순위를 검사한다.

기존 게임 상태/HUD/모달 및 원본 키보드 20,000조합·오버레이 576경우 비교, 전문화/융합 고정 회귀 검사, debug 폴더 없는 배포 실행 검사도 통과했다. 실제 브라우저 키 이벤트·레이아웃·픽셀·FPS 검증은 별도로 남는다.

추가된 production 모듈은 정책 파일 1개다. 전체 JS 모듈 106개, 일반 entry의 전이 모듈 101개이며 debug 모듈은 여전히 0개다. 저장 형식·밸런스·화면 디자인은 변경하지 않았다.
