import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)), src=resolve(root,'src');
const files=readdirSync(src,{recursive:true}).filter(p=>p.endsWith('.js')).map(p=>resolve(src,p));
const contents=new Map(files.map(file=>[file,readFileSync(file,'utf8')]));
test('the former god file is gone and entry/composition files contain only startup and wiring',()=>{
  assert.equal(existsSync(resolve(src,'game.js')),false);
  const main=contents.get(resolve(src,'main.js')), bootstrap=contents.get(resolve(src,'app/create-game.js'));
  assert.ok(main.length<200);assert.match(main,/createGame\(\)/);assert.ok(bootstrap.length<12000);
  assert.doesNotMatch(bootstrap,/function\s+(?:stats|damage|killEnemy|update|draw|renderModal|restoreRun|advanceFusion)\s*\(/);
  assert.doesNotMatch(bootstrap,/\b(?:eval|Function)\s*\(/);assert.doesNotMatch(bootstrap,/Math\.random\(/);
});
test('the complete runtime import graph resolves locally and has no circular imports',()=>{
  const seen=new Set(),active=new Set();
  function visit(file){if(active.has(file))assert.fail('circular import: '+[...active,file].map(p=>relative(src,p)).join(' -> '));if(seen.has(file))return;active.add(file);
    for(const m of contents.get(file).matchAll(/^import\s+[^;]+?from\s+['"]([^'"]+)['"]/gm)){
      assert.ok(m[1].startsWith('.'),'external dependency: '+m[1]);const target=resolve(dirname(file),m[1]);assert.ok(contents.has(target),'missing import: '+target);visit(target);
    }active.delete(file);seen.add(file);
  }
  for(const file of files)visit(file);assert.equal(seen.size,files.length);
});
test('session ownership and import names remain explicit across all application factories',()=>{
  for(const [file,text]of contents){
    if(!file.endsWith('/app/create-game.js'))assert.doesNotMatch(text,/from\s+['"][^'"]*(?:core\/state\.js|\/state\.js)['"]/,'hidden current session import: '+file);
    assert.doesNotMatch(text,/from\s+['"](?:[^'"]*tests\/[^'"]*|(?:[^'"]*\/)?game\.js)['"]/,'test or legacy dependency: '+file);
    const imported=[...text.matchAll(/^import\s+\{([^}]+)\}/gm)].flatMap(m=>m[1].split(',').map(x=>x.trim().split(/\s+as\s+/).at(-1)));
    for(const m of text.matchAll(/export function create\w+\(\{([^}]+)\}/g)){
      const params=m[1].split(',').map(x=>x.trim().split(/\s*=/)[0]);
      assert.deepEqual(params.filter(name=>imported.includes(name)),[],'data/module name shadowing: '+file);
    }
  }
});
