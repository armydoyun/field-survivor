const movementVector = (keys) => {const x=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),y=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0),d=Math.hypot(x,y)||1;return {x:x/d,y:y/d};};

export { movementVector };

// Player movement and momentum share the same normalized input as enemy prediction.
export function movePlayer(r,keys,s,dt){
  const v=movementVector(keys),moving=!!(v.x||v.y);
  if(moving){r.player.x+=v.x*s.speed*dt;r.player.y+=v.y*s.speed*dt;r.momentumTime=1;}else r.momentumTime=Math.max(0,r.momentumTime-dt);
  return moving;
}
