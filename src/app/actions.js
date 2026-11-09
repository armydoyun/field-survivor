import { canInteractInWorld } from '../core/view-policy.js';
// UI action IDs route to existing workflows; no gameplay formulas or dynamic registration.
export function createActions({ view, buildGuide, growthActions, session, screen, storage, story, sites, encounters, journey, finale, objectives }) {
  const exact={
    'fusion-close':growthActions.toggleFusion,'fusion-guide':()=>buildGuide.toggleBuildGuide(true),
    new:()=>session.startFresh(),'new-cancel':()=>{if(view.mode==='newconfirm')screen.setMode(view.newConfirmReturn);},'new-confirm':()=>{if(view.mode==='newconfirm')session.startFresh(true);},
    resume:session.resume,reroll:growthActions.rerollUpgrade,hear:()=>story.chooseSignal('hear'),burn:()=>story.chooseSignal('burn'),
    'witness-hear':()=>story.chooseWitness('hear'),'witness-take':()=>story.chooseWitness('take'),silence:story.acknowledgeSilence,
    'final-enter':finale.beginFinale,'reset-open':()=>{if(view.mode==='menu')screen.setMode('resetconfirm');},'reset-cancel':()=>{if(view.mode==='resetconfirm')screen.setMode('menu');},'reset-confirm':session.resetAllRecords,
    'ledger-open':()=>{if(['menu','ending'].includes(view.mode))screen.setMode('ledger');},'ledger-back':()=>{if(view.mode==='ledger')screen.setMode('menu');},menu:()=>{screen.setMode('menu');storage.save();}
  };
  const prefixes=[['fusion-',growthActions.chooseFusion],['anomaly-',story.chooseAnomaly],['site-',sites.chooseSite],['relic-',sites.chooseRelic],['echo-',encounters.finishEcho],['branch-',growthActions.chooseBranch],['keystone-',journey.chooseKeystone],['final-',finale.chooseFinale],['legacy-',story.chooseLegacy]];
  function dispatch(id){
    if(typeof id!=='string')return false;
    if(Object.hasOwn(exact,id)){exact[id]();return true;}
    for(const [prefix,apply]of prefixes)if(id.startsWith(prefix)){apply(id.slice(prefix.length));return true;}
    return false;
  }
  function overlayClick(event){
    const more=event.target.closest('[data-upgrade-info]');if(more)return buildGuide.openUpgradeInfo(more.dataset.upgradeInfo);
    const choice=event.target.closest('[data-choice]');if(choice)return growthActions.chooseUpgrade(choice.dataset.choice);
    const button=event.target.closest('[data-action]');if(button)dispatch(button.dataset.action);
  }
  function interact(){
    if(!canInteractInWorld(view))return;
    if(story.dismantleGuardian())return;
    if(!sites.meetSite()&&!objectives.meetObjective()){story.meetWitness();if(canInteractInWorld(view)&&!encounters.meetEcho()&&!encounters.meetFront())story.meetLegacy();}
  }
  return { dispatch, overlayClick, interact, toggleFusion:growthActions.toggleFusion };
}
