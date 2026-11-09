export function createHud({ platform, model }) {
  const { $ }=platform,htmlCache=new WeakMap(),keys={};
  function updateHud(){
    const next=model.readHud(keys);
    for(const [id,value]of Object.entries(next.text))$(id).textContent=value;
    for(const [id,value]of Object.entries(next.html)){const node=$(id);if(htmlCache.get(node)!==value){node.innerHTML=value;htmlCache.set(node,value);}}
    for(const [id,value]of Object.entries(next.width))$(id).style.width=value;
    for(const [id,value]of Object.entries(next.hidden))$(id).hidden=value;
    for(const [id,value]of Object.entries(next.keys)){$(id).dataset.key=value;keys[id]=value;}
    $('openFusion').disabled=next.fusionDisabled;$('openFusion').setAttribute('aria-expanded',next.fusionExpanded);
  }
  return { updateHud };
}
