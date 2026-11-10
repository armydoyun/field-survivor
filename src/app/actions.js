import { canInteractInWorld } from '../core/view-policy.js';
// UI action IDs route to existing workflows; no gameplay formulas or dynamic registration.
export function createActions({ stoker, view, buildGuide, growthActions, session, screen, storage, story, sites, journey, finale, objectives, sfx = null }) {
  const exact={
    'fusion-close':growthActions.toggleFusion,'fusion-guide':()=>buildGuide.toggleBuildGuide(true),
    new:()=>session.startFresh(),'new-cancel':()=>{if(view.mode==='newconfirm')screen.setMode(view.newConfirmReturn);},'new-confirm':()=>{if(view.mode==='newconfirm')session.startFresh(true);},
    resume:session.resume,reroll:growthActions.rerollUpgrade,hear:()=>story.chooseSignal('hear'),burn:()=>story.chooseSignal('burn'),
    'witness-hear':()=>story.chooseWitness('hear'),'witness-take':()=>story.chooseWitness('take'),silence:story.acknowledgeSilence,
    'final-enter':finale.beginFinale,'reset-open':()=>{if(view.mode==='menu')screen.setMode('resetconfirm');},'reset-cancel':()=>{if(view.mode==='resetconfirm')screen.setMode('menu');},'reset-confirm':session.resetAllRecords,
    'loadout-back':()=>{if(view.mode==='loadout')screen.setMode('menu');},'ledger-open':()=>{if(['menu','ending'].includes(view.mode))screen.setMode('ledger');},'ledger-back':()=>{if(view.mode==='ledger')screen.setMode('menu');},menu:()=>{screen.setMode('menu');storage.save();}
  };
  const prefixes=[['start-',weapon=>{if(view.mode==='loadout')session.startFresh(true,weapon);}],['fusion-',growthActions.chooseFusion],['anomaly-',story.chooseAnomaly],['site-',sites.chooseSite],['relic-',sites.chooseRelic],['branch-',growthActions.chooseBranch],['keystone-',journey.chooseKeystone],['final-',finale.chooseFinale]];
  function dispatch(id){
    if(typeof id!=='string')return false;
    if(Object.hasOwn(exact,id)){sfx?.play('select');exact[id]();return true;}
    for(const [prefix,apply]of prefixes)if(id.startsWith(prefix)){sfx?.play('select');apply(id.slice(prefix.length));return true;}
    return false;
  }
  function overlayClick(event){
    const more=event.target.closest('[data-upgrade-info]');if(more)return buildGuide.openUpgradeInfo(more.dataset.upgradeInfo);
    const choice=event.target.closest('[data-choice]');if(choice){sfx?.play('select');return growthActions.chooseUpgrade(choice.dataset.choice);}
    const button=event.target.closest('[data-action]');if(button)dispatch(button.dataset.action);
  }
  function interact(){
    if(!canInteractInWorld(view))return;
    if(story.dismantleGuardian())return;
    if(stoker?.stokeFire())return;
    if(!sites.meetSite()&&!objectives.meetObjective())story.meetWitness();
  }
  return { dispatch, overlayClick, interact, toggleFusion:growthActions.toggleFusion };
}
