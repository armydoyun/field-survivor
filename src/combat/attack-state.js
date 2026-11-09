/** @typedef {{id:number, at:number, count:number, tag?:string}} AttackHit
 * @typedef {{x:number, y:number}} AttackPoint
 * @typedef {{x1:number,y1:number,x2:number,y2:number,width:number,active:boolean}} AttackLine Width is capsule half-width.
 * @typedef {{owner:string,phase:string,clock:number,age:number,hits:AttackHit[],lines:AttackLine[],units:AttackPoint[],points:AttackPoint[],cells:Object[],order:number[],occupants:number[],path:AttackPoint[]}} FusionState
 * @typedef {{owner:string,x:number,y:number,age:number,life:number,hit:AttackHit[],backHit:AttackHit[],marks:(number|AttackHit)[],points:AttackPoint[],seen:number[]}} FieldBase
 * @typedef {{type:'nova',phase:'expand'|'hold'|'return',radius:number,length?:number}} NovaField
 * @typedef {{type:'chain',phase:'forward'|'reverse'|'loop',target:number,index:number,clock:number}} ChainField
 * @typedef {{type:'lance',phase:'out'|'back'|'stay',x1:number,y1:number,dx:number,dy:number,count:number,pierce:number}} LanceField
 * @typedef {{type:'mine',phase:'arm'|'wait'|'pressed'|'jump'|'open',occupied:boolean,loaded:number,sx?:number,sy?:number,tx?:number,ty?:number}} MineField
 * @typedef {{type:'rift',phase:'prepare'|'fold'|'record'|'open',angle:number,length:number,width:number,target:number,index:number,clock:number}} RiftField
 * @typedef {FieldBase & (NovaField|ChainField|LanceField|MineField|RiftField)} SpecField
 * Hit buckets contain records except rift's marks bucket, which is created on first hit. NOVA marks contains IDs.
 */
/** @returns {FusionState} */
export function makeFusionState(owner){return {owner,phase:'wait',clock:.25,age:0,hits:[],lines:[],units:[],points:[],cells:[],order:[],occupants:[],path:[]};}
export function resetFusionCycle(q,rest){q.phase='wait';q.clock=rest;q.lines=[];q.units=[];}
/** @returns {?SpecField} */
export function createSpecField(r,owner,data){
  const a=r.arsenal;if(a.fields.length>=40)return null;const f={owner,type:owner,x:r.player.x,y:r.player.y,age:0,life:10,phase:'prepare',hit:[],backHit:[],marks:[],points:[],seen:[],...data};a.fields.push(f);return f;
}
// Distinct specialization buckets and fusion tags retain their existing caps and ordering.
export function recordAttackHit(list,id,time,gap=0,limit=1,tag,capacity=Infinity){
  const old=list.find(h=>h.id===id&&(tag===undefined||h.tag===tag));if(old&&(old.count>=limit||time-old.at<gap))return false;
  if(old){old.count++;old.at=time;}else{if(list.length>=capacity)return false;list.push({id,...(tag===undefined?{}:{tag}),at:time,count:1});}return true;
}
