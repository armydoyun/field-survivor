import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, copyFile, rm } from 'node:fs/promises';
import { resolve, dirname, relative, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createMockBrowser } from './mock-browser.js';

const root=fileURLToPath(new URL('../',import.meta.url));
async function productionGraph(){
  const files=new Map();async function visit(file){if(files.has(file))return;const code=await readFile(file,'utf8');files.set(file,code);for(const m of code.matchAll(/(?:import|export)\s+[^;]+?from\s+['"]([^'"]+)['"]/g)){assert.ok(m[1].startsWith('.'));await visit(resolve(dirname(file),m[1]));}}
  await visit(resolve(root,'src/main.js'));return files;
}

test('production entry has no debug module in its complete transitive import graph',async()=>{
  const files=await productionGraph();assert.ok(files.size>80);for(const [file,code]of files){assert.ok(!relative(root,file).startsWith('src/debug/'),file);assert.doesNotMatch(code,/import\s*\(|DEBUG LAB|fieldSurvivorDebug|mountDebugPanel|createDebugGame|readDebugOptions|combat-inspector/);}
  const html=await readFile(resolve(root,'index.html'),'utf8'),debug=await readFile(resolve(root,'debug.html'),'utf8');assert.match(html,/src="\.\/src\/main\.js"/);assert.doesNotMatch(html,/debug\/|panel\.css/);assert.match(debug,/src="\.\/src\/debug\/main\.js"/);assert.match(debug,/src\/debug\/panel\.css/);
});
test('production boots, plays and disposes with the entire debug directory physically absent',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'field-survivor-release-')),files=await productionGraph(),env=createMockBrowser({observers:true}),descriptors=new Map();env.location={search:'?debug=1&seed=42'};
  try{
    await copyFile(resolve(root,'package.json'),join(directory,'package.json'));
    for(const file of files.keys()){const target=join(directory,relative(root,file));await mkdir(dirname(target),{recursive:true});await copyFile(file,target);}
    for(const [key,value]of Object.entries(env)){descriptors.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
    const {createGame}=await import(pathToFileURL(join(directory,'src/app/create-game.js')).href),app=createGame();try{
      assert.equal(app.debug,undefined);const button={dataset:{action:'new'},closest:s=>s==='[data-action]'?button:null};env.document.getElementById('overlay').dispatch('click',{target:button});env.dispatch('keydown',{code:'F7'});env.__inspect.flushFrame(1016);assert.equal(env.__inspect.frames.size,1);assert.match(env.document.getElementById('pauseButton').innerHTML,/일시정지/);const state=await import(pathToFileURL(join(directory,'src/core/state.js')).href);assert.ok(state.run.time>0);const x=state.run.player.x;env.dispatch('keydown',{code:'KeyD'});env.__inspect.flushFrame(1032);assert.ok(state.run.player.x>x);
    }finally{app.dispose();}assert.equal(env.__inspect.listenerCount(),0);assert.equal(env.__inspect.frames.size,0);
  }finally{for(const [key,d]of descriptors)if(d)Object.defineProperty(globalThis,key,d);else delete globalThis[key];await rm(directory,{recursive:true,force:true});}
});
