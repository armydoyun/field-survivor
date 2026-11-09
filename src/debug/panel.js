import { escapeHtml } from '../ui/html.js';

export function mountDebugPanel({tools,view,platform,inspector,seed}){
  const root=document.createElement('aside'),dock=document.createElement('button');root.id='fieldDebugPanel';root.setAttribute('aria-label','개발 실험 패널');dock.id='fieldDebugDock';dock.type='button';dock.textContent='DEBUG · F10';
  const option=(value,label)=>`<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`,button=(id,text)=>`<button type="button" data-debug-action="${id}">${text}</button>`;
  const check=(key,text)=>`<label class="debug-check"><input type="checkbox" data-setting="${key}"> ${text}</label>`;
  root.innerHTML=`<header><strong>FIELD · DEBUG LAB</strong>${button('close','접기 F10')}</header><p class="debug-note">개발 전용 · 기존 저장과 분리 · 새로고침 시 실험 기록 소멸</p>
    <p class="debug-note"><a href="./visual-review/index.html" target="_blank" rel="noopener" style="color:#9de7ff">스킬 그래픽 검토 갤러리</a> · F6로 판정을 끄고 그래픽을 확인하세요.</p><output data-report></output><div class="debug-row">${button('hold','정지/재개 F7')}${button('step','1/60초 F8')}${button('overlay','판정 표시 F6')}</div>
    <label>배속 <select data-setting="timeScale">${[.25,.5,1,2,4].map(n=>option(n,n+'×')).join('')}</select></label>
    <details open><summary>실험 조건</summary><div class="debug-grid">${check('autoSpawn','자연·웨이브·감시자 생성')}${check('worldEvents','세계 사건 진행')}${check('choices','성장 선택창')}${check('playerAttacks','플레이어 공격')}${check('basePulse','기본 PULSE')}${check('enemyAI','적 이동·AI')}${check('hostileProjectiles','적 탄환·장판')}${check('godMode','플레이어 피해 차단')}${check('blockEnemyDamage','적 피해 차단')}${check('reducedMotion','저동작 강제')}${check('lowDetail','저상세 강제')}</div><small>자동 생성 OFF여도 보스 패턴·사망 분열은 유지됩니다.</small></details>
    <details open><summary>스킬 · 전문화</summary><select name="skill">${tools.catalog.skills.map(s=>option(s.id,s.name+` (최대 ${s.max})`)).join('')}</select><div class="debug-row"><label>레벨 <input name="level" type="number" min="1" max="12" value="4"></label>${button('skill','추가 / 변경')}${button('isolate','단독 빌드')}</div><small>기본 무기·전문화·융합을 지급합니다. 상위융합은 기반 경로도 선택하며 필요한 재료를 자동 구성합니다.</small><div class="debug-row">${button('build-clear','빌드 초기화')}${button('cooldowns','공격·쿨다운 초기화')}</div></details>
    <details open><summary>적 생성 · 배치</summary><select name="enemy">${tools.catalog.enemies.map(e=>option(e.kind,e.name)).join('')}</select><div class="debug-row"><label>수 <input name="count" type="number" min="1" max="50" value="1"></label><label>거리 <input name="distance" type="number" min="0" max="1000" value="180"></label><label>각도° <input name="angle" type="number" min="-3600" max="3600" value="0"></label></div><div class="debug-row"><select name="formation">${option('ring','원형')}${option('line','일렬')}${option('point','한 지점')}</select><label><input name="elite" type="checkbox"> 강화</label></div><label>체력 덮어쓰기 <input name="enemyHp" type="number" min="1" max="1000000000" placeholder="비우면 원래 수치"></label><div class="debug-row">${button('spawn','지정 적 생성')}${button('dummy','정지 표적 HP 10억')}</div>${button('core','최종 코어 생성')} ${button('clear','적·탄환·장판 제거')}<small>정지 표적 버튼은 전체 적 AI를 OFF로 바꿉니다. 화면 밖 기존 적 유지 규칙은 그대로 적용됩니다.</small></details>
    <details><summary>체력 · 시간 · 위치</summary><div class="debug-row">${button('heal','전체 회복')}<input name="hp" type="number" min="1" value="100">${button('hp','HP 설정')}</div><div class="debug-row"><input name="damage" type="number" min="1" max="10000" value="10">${button('hurt','규칙대로 피격')}</div><small>피격은 피해 차단·방어·무적 시간 규칙을 적용합니다.</small><div class="debug-row"><input name="time" type="number" min="0" max="7200" value="900">${button('time','시간 설정+전장 비우기')}</div><div class="debug-row"><input name="x" type="number" value="480" aria-label="x 좌표"><input name="y" type="number" value="270" aria-label="y 좌표">${button('teleport','이동')}</div>${button('effects','효과 지우기')}</details>
    <details><summary>시드 · 체크포인트 · 파일</summary><div class="debug-row"><input name="seed" type="number" min="0" max="4294967295" value="${Number(seed)}">${button('new','새 실험 판')}</div><small>새 실험 판은 현재 판을 교체합니다. 필요하면 먼저 체크포인트를 저장하세요.</small><div class="debug-row">${button('checkpoint-save','체크포인트 저장')}${button('checkpoint-load','복원')}${button('export','JSON 내보내기')}</div><label>JSON 불러오기 <input name="snapshot" type="file" accept=".json,application/json"></label></details>
    <output data-status aria-live="polite">준비됨 · 새 판은 개발 정지 상태로 시작합니다.</output>`;
  document.body.appendChild(root);document.body.appendChild(dock);
  const listeners=[],listen=(node,type,fn)=>{node.addEventListener(type,fn);listeners.push([node,type,fn]);};let open=true,disposed=false,last=-Infinity;
  const node=name=>root.querySelector(`[name="${name}"]`),value=name=>node(name)?.value,checked=name=>!!node(name)?.checked;
  const status=text=>{const output=root.querySelector('[data-status]');if(output)output.textContent=String(text);};
  const show=()=>{root.hidden=view.panic||!open;dock.hidden=view.panic||open;};
  function refresh(now=performance.now()){
    show();if(disposed||root.hidden||now-last<200)return;last=now;const report=tools.report(),metrics=inspector.report(),output=root.querySelector('[data-report]');
    if(output)output.textContent=`${report.mode} · ${report.held?'정지':'진행'} · ${report.time.toFixed(2)}s · seed ${report.seed??'-'}\nHP ${Math.ceil(report.hp||0)}/${Math.ceil(report.maxHp||0)} · 적 ${report.enemies} · 아군탄 ${report.shots} · 적탄 ${report.bullets}\n평균 update ${metrics.mean.update.toFixed(2)}ms / render ${metrics.mean.render.toFixed(2)}ms`;
    for(const input of root.querySelectorAll('[data-setting]')){const setting=report.settings[input.dataset.setting];if(input.type==='checkbox')input.checked=setting;else input.value=String(setting);}
  }
  function invoke(fn){try{const result=fn();status(Array.isArray(result)?`${result.length}개 생성됨`:'적용됨');last=-Infinity;refresh();}catch(error){status(error.message);}}
  const actions={close:()=>{open=false;show();},hold:()=>{if(!tools.hold(!tools.report().held))throw Error('플레이 화면에서만 정지/재개할 수 있습니다.');},step:()=>{if(!tools.step())throw Error('플레이 화면에서만 한 단계 진행할 수 있습니다.');},overlay:()=>inspector.keydown({code:'F6',preventDefault(){}}),
    skill:()=>tools.giveSkill(value('skill'),value('level')),isolate:()=>tools.giveSkill(value('skill'),value('level'),{isolate:true}), 'build-clear':tools.clearBuild,cooldowns:tools.resetCooldowns,
    spawn:()=>tools.spawn(value('enemy'),value('count'),{elite:checked('elite'),distance:value('distance'),angle:value('angle'),formation:value('formation'),hp:value('enemyHp')}),
    dummy:()=>{const ids=tools.spawn(0,1,{distance:160,hp:1e9});tools.configure('enemyAI',false);return ids;},core:tools.spawnCore,clear:tools.clearThreats,effects:tools.clearEffects,heal:tools.heal,
    hp:()=>tools.setHp(value('hp')),hurt:()=>tools.hurt(value('damage')),time:()=>tools.setTime(value('time')),teleport:()=>tools.teleport(value('x'),value('y')),new:()=>tools.start(value('seed')),
    'checkpoint-save':tools.saveCheckpoint,'checkpoint-load':tools.loadCheckpoint,export:()=>{const url=URL.createObjectURL(new Blob([tools.snapshot()],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='FIELD-Survivor-debug-snapshot.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  };
  listen(root,'click',event=>{const action=event.target.closest('[data-debug-action]')?.dataset.debugAction;if(actions[action])invoke(actions[action]);});
  listen(root,'change',async event=>{
    const target=event.target;if(target.dataset.setting){invoke(()=>tools.configure(target.dataset.setting,target.type==='checkbox'?target.checked:target.value));return;}
    if(target.name==='snapshot'&&target.files?.[0]){try{const text=await target.files[0].text();if(!disposed)invoke(()=>tools.loadSnapshot(text));}catch(error){status(error.message);}target.value='';}
  });
  listen(root,'pointerdown',()=>platform.keys.clear());listen(root,'focusin',()=>platform.keys.clear());
  listen(root,'keydown',event=>{if(['F9','F10'].includes(event.code))return;if(['F6','F7','F8'].includes(event.code))event.preventDefault();event.stopPropagation();});
  listen(dock,'click',()=>{open=true;last=-Infinity;refresh();});
  const previousKey=inspector.keydown,previousFrame=inspector.afterFrame;
  inspector.keydown=event=>{
    if(event.code==='F9'){root.hidden=true;dock.hidden=true;}
    if(event.code==='F10'&&!view.panic&&!event.repeat&&!event.isComposing&&!event.ctrlKey&&!event.metaKey&&!event.altKey){event.preventDefault();platform.keys.clear();open=!open;last=-Infinity;refresh();return true;}
    return previousKey(event);
  };
  inspector.afterFrame=now=>{previousFrame?.(now);refresh(now);};const unsubscribe=tools.subscribe(()=>{last=-Infinity;refresh();});refresh();
  return {dispose(){if(disposed)return;disposed=true;unsubscribe();inspector.keydown=previousKey;inspector.afterFrame=previousFrame;for(const [node,type,fn]of listeners)node.removeEventListener(type,fn);root.remove();dock.remove();}};
}
