import { enemyType, eliteTraits } from '../data/enemies.js';
import { W, H } from '../core/config.js';
import { clamp } from '../core/utils.js';

export function createEnemySpawner({ paceAt, pressureProfile, enemyHealthScale, lateCombat, random = Math.random }) {
  function promoteElite(run,e){if(e.elite||e.kind===3||e.coreNode)return e;const t=eliteTraits[e.kind];if(!t)return e;e.elite=true;const hp=t.hp*enemyHealthScale(e.kind,true,run)/enemyHealthScale(e.kind,false,run);e.hp*=hp;e.maxHp*=hp;e.speed*=t.speed;e.radius+=3;e.eliteClock=(2+(e.id%7)*.3)*(1-lateCombat(run)*.7);e.eliteCasts=0;return e;}

  function placeOffscreen(run,e,camera){
    const cx=camera.owner===run?camera.x:run.player.x,cy=camera.owner===run?camera.y:run.player.y;
    const inside=(x,y) => Math.abs(e.x-x)<W/2+e.radius+30&&Math.abs(e.y-y)<H/2+e.radius+30;
    if(inside(cx,cy)||inside(run.player.x,run.player.y)){const dx=e.x-run.player.x,dy=e.y-run.player.y;if(Math.abs(dx)>Math.abs(dy)){e.x=run.player.x+Math.sign(dx||1)*(W/2+e.radius+100);e.y=run.player.y+dy;}else{e.y=run.player.y+Math.sign(dy||1)*(H/2+e.radius+100);e.x=run.player.x+dx;}if(inside(cx,cy)){if(Math.abs(e.x-cx)>Math.abs(e.y-cy))e.x=cx+Math.sign(e.x-cx||1)*(W/2+e.radius+40);else e.y=cy+Math.sign(e.y-cy||1)*(H/2+e.radius+40);}}
  }

  function spawnWeights(time) {
    const weights=[{kind:0,weight:time<240?58:28}];
    for(const [kind,at,weight] of [[1,15,20],[4,45,11],[2,60,12],[5,90,7],[6,180,10],[7,240,8],[9,480,6],[8,600,4],[10,720,5]])if(time>=at)weights.push({kind,weight});
    return weights;
  }

  function chooseSpawnKind(run) {
    const w=spawnWeights(run.time).map(x=>({...x,weight:x.weight*(x.kind>=7?(1+lateCombat(run)*.7)*pressureProfile(run).tactics:x.kind===0?(1-lateCombat(run)*.35)*(2-pressureProfile(run).tactics):1)})).filter(x=>{const cap=({4:14,5:10,7:10,8:4,9:5,10:run.time<1200?2:3})[x.kind];return !cap||run.enemies.filter(e=>e.kind===x.kind&&e.hp>0&&!e.coreNode).length<cap;});
    let x=random()*w.reduce((sum,x)=>sum+x.weight,0);for(const a of w){x-=a.weight;if(x<0)return a.kind;}return 0;
  }

  function spawnEnemy(run,kind = -1,camera) {
    const pace = paceAt(run.time), randomSpawn = kind < 0;
    if (randomSpawn) kind = chooseSpawnKind(run);
    const elite = randomSpawn && kind !== 3 && random() < clamp(pace.elite+pressureProfile(run).elite,0,.5);
    const p = run.player, edge = Math.floor(random() * 4), margin = 36 + random() * 48;
    const x = p.x + (edge === 0 ? -W / 2 - margin : edge === 1 ? W / 2 + margin : (random() - 0.5) * W);
    const y = p.y + (edge === 2 ? -H / 2 - margin : edge === 3 ? H / 2 + margin : (random() - 0.5) * H);
    const type = enemyType[kind], hp = type.hp * pace.hp * enemyHealthScale(kind,false,run);
    const e = { id: run.nextId++, kind, x, y, hp, maxHp: hp, elite: false, speed: type.speed * pace.speed, radius: type.radius, orbitHitAt: 0, phase: 0, ...(kind === 3 ? { bossCycle: 0 } : {}), xpScale:randomSpawn&&kind!==3?1/Math.max(1,pressureProfile(run).spawn):1, aiTimer: kind === 3 ? 2.1 : (1 + random() * 1.5)*(1-lateCombat(run)*.55), dx: 0, dy: 0, flash: 0 };
    if(elite)promoteElite(run,e);placeOffscreen(run,e,camera);run.enemies.push(e);return e;
  }

  return { promoteElite, placeOffscreen, spawnWeights, chooseSpawnKind, spawnEnemy };
}
