import { enemyType } from '../data/enemies.js';
import { segmentHit } from '../math/geometry.js';
import { incomingScale } from './rules.js';
import { GUARDIAN_TRIAL, GUARDIAN_YIELD } from '../core/config.js';

const guardianMood = (profile,r) => r?.guardianOrder || (profile.memory.guardian.spared > profile.memory.guardian.ended ? 'spare' : profile.memory.guardian.ended > profile.memory.guardian.spared ? 'end' : '');

const guardianSpread = (profile,run) => guardianMood(profile,run) === 'spare' ? [-.26,-.13,0,.13,.26] : guardianMood(profile,run) === 'end' ? [-.18,0,.18] : [-.22,-.07,.07,.22];

function guardianPool(run,e) {const pool=['bloom','fan','charge'];if(run.time>=360||e.hp/e.maxHp<.72)pool.push('sweep');if(run.time>=600)pool.push('bombard');return pool;}

export { guardianMood, guardianSpread, guardianPool };

export function createGuardians({ attacks, movementVector, hurtPlayer, random = Math.random }) {
  const { groundMark, enemyShot } = attacks;

  function startGuardianAttack(run,profile,e,forced) {
    const p=run.player,pool=guardianPool(run,e).filter(k=>k!==e.lastAttack),kind=forced||pool[Math.floor(random()*pool.length)],v=movementVector(),lead=kind==='charge'?110:kind==='fan'?115:0;
    const angle=Math.atan2(p.y+v.y*lead-e.y,p.x+v.x*lead-e.x);
    e.guardianAttack={kind,x:p.x,y:p.y,angle,step:0,clock:0};e.lastAttack=kind;e.bossCycle=(e.bossCycle||0)+1;e.phase=1;e.dx=Math.cos(angle);e.dy=Math.sin(angle);
    const base={bloom:1.05,fan:1.1,charge:1.2,sweep:1.25,bombard:1.2}[kind],mood=guardianMood(profile,run);
    e.aiTimer=Math.max(run.time<360?1.05:.85,base*(run.signalHp>=40?1.15:run.signalPower>=2?.9:1)*(mood==='end'?.9:1)+(mood==='spare'?.12:0));
  }

  function recoverGuardian(run,profile,e) {e.phase=4;e.guardianAttack=null;e.aiTimer=(guardianMood(profile,run)==='spare'?1.65:guardianMood(profile,run)==='end'?1.05:1.35)+(run.objectiveOutcomes.relay==='complete'?.2:0);}

  // 시험을 버텼다: 공격과 공격 사이(대기 · 회복)에 감시자가 먼저 무기를 내린다. 처치와 같은 선택(돌려보냄 · 분해)으로 이어진다.
  function trialOver(run,e){
    if(!e.named||run.guardianMeetAt==null||(e.phase!==0&&e.phase!==4))return false;
    return run.time>=run.guardianMeetAt+GUARDIAN_TRIAL[Math.max(0,Math.min(GUARDIAN_TRIAL.length,run.guardianMeet||1)-1)];
  }

  function moveGuardian(run,profile,e,dt,speed,distance,nx,ny) {
    if(e.phase===3)return;
    if(trialOver(run,e)){e.hp=0;e.phase=3;e.guardianAttack=null;e.trialYield=true;run.bossChoiceId=e.id;e.yieldUntil=run.time+GUARDIAN_YIELD;e.yieldStill=0;return;}
    const a=e.guardianAttack,p=run.player,mood=guardianMood(profile,run),broken=mood==='end',returned=mood==='spare';
    if(e.phase===0){e.x+=nx*speed*dt;e.y+=ny*speed*dt;if(e.aiTimer<=0&&distance<540)startGuardianAttack(run,profile,e);}
    else if(e.phase===4){if(e.aiTimer<=0){e.phase=0;e.aiTimer=run.time<360?1.3:.9;}}
    else if(!a){e.phase=0;e.aiTimer=1.1;}
    else if(e.phase===1&&e.aiTimer>0){if(['fan','charge','sweep'].includes(a.kind)&&e.aiTimer>.4){const v=movementVector(),lead=a.kind==='charge'?110:a.kind==='fan'?115:0;a.angle=Math.atan2(p.y+v.y*lead-e.y,p.x+v.x*lead-e.x);e.dx=Math.cos(a.angle);e.dy=Math.sin(a.angle);}}
    else if(e.phase===1&&e.aiTimer<=0){
      e.phase=2;e.aiTimer=a.kind==='charge'?.6:3;a.clock=0;
      if(a.kind==='bombard'){const v=movementVector(),offsets=[0,returned?115:90,returned?-115:-90];for(let i=0;i<3;i++)groundMark(run,e,p.x+v.x*offsets[i]+(v.x||v.y?0:offsets[i]),p.y+v.y*offsets[i],broken?51:44,.95+i*.22,.24,14);a.step=3;recoverGuardian(run,profile,e);}
    } else if(e.phase===2){
      if(a.kind==='charge'){
        const oldX=e.x,oldY=e.y,slow=run.time<(e.slowUntil||0)?1-(e.slowAmount||0):1;e.x+=e.dx*460*slow*dt;e.y+=e.dy*460*slow*dt;
        if(segmentHit(oldX,oldY,e.x,e.y,p.x,p.y,e.radius+11))hurtPlayer(Math.round(21*incomingScale(run.time)),run);
        if(e.aiTimer<=0)recoverGuardian(run,profile,e);
      } else {
        a.clock-=dt;
        if(a.clock<=0){
          if(a.kind==='bloom'){const count=returned?6:broken?10:8,start=a.angle+(a.step?Math.PI/count:0);for(let i=0;i<count;i++)enemyShot(run,e,start+i*2*Math.PI/count,run.time<360?165:185,11,6,3.3,true);a.step++;a.clock=.42;if(a.step>=(!returned?2:1))recoverGuardian(run,profile,e);}
          else if(a.kind==='fan'){const spread=guardianSpread(profile,run);for(const offset of spread)enemyShot(run,e,a.angle+offset,returned?210:240,11,5,2.8,true);a.step++;a.clock=.3;if(a.step>=(returned?2:3))recoverGuardian(run,profile,e);}
          else if(a.kind==='sweep'){const angle=a.angle-.65+a.step*.325;for(const off of [-.065,.065])enemyShot(run,e,angle+off,returned?180:210,10,5,2.8,true);a.step++;a.clock=returned?.32:.24;if(a.step>=5)recoverGuardian(run,profile,e);}
        }
      }
    }
    if(Math.hypot(p.x-e.x,p.y-e.y)<e.radius+11)hurtPlayer(Math.round(enemyType[3].contact*incomingScale(run.time)),run);
  }

  return { startGuardianAttack, recoverGuardian, moveGuardian };
}
