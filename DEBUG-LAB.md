# DEBUG LAB — v2.6.27

로컬 서버에서 `debug.html?seed=42`를 연다. 일반 게임은 `index.html`이다. 개발 실험실은 독립 세션/메모리 저장을 사용하며 일반 localStorage를 읽거나 쓰지 않는다. 새로고침 전 필요한 실험은 JSON으로 저장한다.

- 기본 무기·패시브 레벨 지정, 전문화 16개 지급, 단독 빌드.
- 적 11종/지원 강화형, 수량·배치·거리·HP 설정, 정지 표적과 최종 코어.
- 자연/웨이브/감시자 생성, 세계 사건, AI, 탄환/장판, 공격/피해, 효과 표시 제어.
- 정지·1/60초 진행·배속·시드·시간·이동·HP·공격 초기화.
- 체크포인트, JSON 저장/복원. 정규화된 게임 상태이며 입력 리플레이는 아니다.

F6 판정 표시, F7 정지/재개, F8 한 단계, F10 패널, F9 프라이버시. 자동 생성 OFF도 보스의 소환/사망 분열 자체를 막지는 않는다. 세계 사건과 AI/탄환은 별도 스위치다.

**새 융합 32개 제작 경로를 지급할 수 있다.** 목록의 상위 항목은 같은 이름 뒤에 기반 이름을 표시한다. `giveSkill('fusion:fs_instant_slash',4,{isolate:true})`는 순간 참격 단독 빌드, `giveSkill('fusion:hs_thunder_slash_instant_slash',1,{isolate:true})`는 순간 참격 기반 천뢰 참격이다. 필요한 원본 Lv5·전문화·기반 Lv4를 자동 구성한다. 구 fleet/ark 등 ID 지급은 여전히 상태 변경 없이 거절한다.

일반 플레이의 실제 제작은 자동 보충하지 않는다. 조건 테스트는 스냅샷의 레벨/경로를 바꾼 뒤 불러와 G 조합창을 확인한다. 공격 중단 설정은 융합에도 적용되고, 체크포인트는 탄환·파면·창·기뢰의 시계와 명중 기록을 보존한다.

```js
const lab=fieldSurvivorDebug.tools;
lab.giveSkill('spec:nova:boundary',4,{isolate:true});
lab.spawn(0,10,{distance:160,hp:100000});
lab.configure('enemyAI',false);
lab.hold(false);
lab.saveCheckpoint();
lab.loadCheckpoint();
```

배포는 `src/main.js`를 번들링한다. 일반 entry의 전이 모듈 97개에 debug 모듈은 0개다. `debug.html`과 `src/debug/`를 제외할 수 있다. `npm run test:release`로 검사한다. 실브라우저 레이아웃·다운로드 대화상자·FPS 검증은 미실행이다.

## 그래픽 확인

패널의 스킬 그래픽 검토 갤러리 링크로 원본·전문화·융합·상위 및 겹침 장면을 비교한다. 실시간 비교 시 F6로 판정 표시를 끈다. 저상세·저동작 강제 토글도 시험한다. 갤러리 폴더와 개발 도구는 배포에서 제외할 수 있다.
