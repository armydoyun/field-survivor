// Combat owns removal of attacks when a weapon changes form. Persisted investment stays intact.
function retireWeaponAttacks(r,weapons){for(const w of weapons)delete r.arsenal.states[w];r.arsenal.fields=r.arsenal.fields.filter(e=>!weapons.includes(e.owner));r.shots=r.shots.filter(e=>!weapons.includes(e.kind));if(weapons.includes('mine'))r.mines=[];if(weapons.includes('beacon'))r.beacons=[];}

export { retireWeaponAttacks };
