// A deterministic DOM/Canvas substitute for logic and lifecycle checks; not a layout engine.
export function createMockBrowser({ observers = false, trace = false } = {}) {
  const noop=()=>{}, elements=new Map(), storage=new Map(), targets=new Set(), frames=new Map(), activeObservers=new Set();
  const eventTarget=target=>{const listeners=new Map();targets.add(listeners);
    target.addEventListener=(type,handler)=>{if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(handler);};
    target.removeEventListener=(type,handler)=>listeners.get(type)?.delete(handler);
    target.dispatch=(type,event={})=>{event.type=type;event.target??=target;event.preventDefault??=noop;for(const handler of [...(listeners.get(type)||[])])handler.call(target,event);};return target;
  };
  const canvasTrace=[];
  const ctx=new Proxy({measureText:text=>({width:String(text).length*7}),createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop})},{get:(o,k)=>{const value=k in o?o[k]:noop;return trace&&typeof value==='function'?(...args)=>{canvasTrace.push(['call',k,...args]);return value(...args);}:value;},set:(o,k,v)=>{if(trace)canvasTrace.push(['set',k,v&&typeof v==='object'?'gradient':v]);o[k]=v;return true;}});
  class Element {
    constructor(id=''){eventTarget(this);this.id=id;this.dataset={};this.style={};this.hidden=true;this.innerHTML='';this.textContent='';this.width=960;this.height=540;this.clientWidth=960;this.clientHeight=540;this.scrollTop=0;this.classList={add:noop,remove:noop,toggle:noop,contains:()=>false};}
    getContext(){return ctx;}getBoundingClientRect(){return{width:960,height:540,x:0,y:0,left:0,top:0};}getClientRects(){return[this.getBoundingClientRect()];}
    focus(){}contains(){return false;}closest(){return null;}querySelectorAll(){return [];}querySelector(){return null;}scrollIntoView(){}appendChild(){}remove(){}replaceChildren(){}insertAdjacentHTML(){}setAttribute(){}removeAttribute(){}
  }
  const get=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
  let seed=123456789, nextFrame=1;const math=Object.create(Math);math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const document=eventTarget({getElementById:get,querySelectorAll:()=>[],querySelector:get,createElement:()=>new Element(),activeElement:new Element(),documentElement:new Element(),body:new Element(),hidden:false});
  const env=eventTarget({console,Math:math,document,Element,performance:{now:()=>1000},requestAnimationFrame:callback=>{const id=nextFrame++;frames.set(id,callback);return id;},cancelAnimationFrame:id=>frames.delete(id),setTimeout:noop,clearTimeout:noop,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},getComputedStyle:()=>({display:'block'}),devicePixelRatio:1,innerWidth:1280,innerHeight:900});
  env.window=env;
  if(observers)env.ResizeObserver=class{constructor(callback){this.callback=callback;}observe(){activeObservers.add(this);}disconnect(){activeObservers.delete(this);}};
  env.__inspect={canvasTrace,elements,frames,activeObservers,listenerCount:()=>[...targets].reduce((sum,map)=>sum+[...map.values()].reduce((n,set)=>n+set.size,0),0),flushFrame:now=>{const batch=[...frames.values()];frames.clear();for(const callback of batch)callback(now);}};
  return env;
}
