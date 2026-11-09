import { episodeKinds } from '../data/world.js';
import { W, H, FIRST_GUARDIAN, HARVEST_CAP } from './config.js';

const makeDirector=()=>({clock:0,engaged:0,damage:0,kills:0,hits:0,crowdSum:0,specialKills:0,specialActed:0,lifeSum:0,life:0,actionRate:1,specialSamples:0,dps:0,killRate:0,hitRate:0,crowd:0,samples:0,value:0});

function makeJourney(plan, random = Math.random) {
  if(!plan){const field=Math.floor(random()*3),other=(field+1+Math.floor(random()*2))%3;plan=[450,840,1200,1590].map((at,slot)=>({at:at+Math.floor(random()*31)-15,kind:slot===0?'witness':slot===2?'guardian':episodeKinds[slot===1?field:other],slot}));}
  return { plan,step:0,active:null,outcomes:[],keystone:null,keystonePending:false,core:null };
}

function createRun(profile, { maxHp, xpNext, journey = makeJourney() }) {
  return { fusionStates:{},fusionTrail:[],arsenal:makeArsenal(), director:makeDirector(), hazards: [], journey, riftClock: 2.8, beaconClock: 3.8, beacons: [], ambientClock: 8, time: 0, level: 1, xp: 0, xpFraction: 0, rerolls: profile.perks.reroll || 0, xpNext, kills: 0, gold: 0, xpReserve: 0, player: { x: W / 2, y: H / 2, hp: maxHp, hurt: 0 }, enemies: [], shots: [], bullets: [], gems: [], pickups: [], pickupClock: 55, invulnUntil: 0, recoveryUntil: 0, fx: [], popups: [], arcs: [], waves: [], up: {}, branches: {}, nextId: 1, attackClock: 0, novaClock: 2.8, chainClock: 0, orbitGuards: [], spawnClock: 0.9, nextBoss: FIRST_GUARDIAN, stage: 0, waveIndex: 0, bossChoiceId: 0, pending: 0, choices: null, anomalyStep: 0, anomalyPending: false, anomalyChoices: {}, anomalyUntil: {}, anomalyWardAt: 0, siteStep: 0, site: null, sitePending: false, siteDecisions: {}, objectiveStep: 0, objective: null, objectiveOutcomes: {}, legacyOrigin: profile.memory.lastResolution?.ending || null, legacyVariant: profile.memory.lastResolution?.variant || '', guardianFate: { spare: 0, end: 0 }, guardianOrder: '', guardianMeet: 0, relics: [], relicPending: null, relicFreezeUntil: 0, relicCooldown: 0, harvestBudget: HARVEST_CAP, lanceClock: 1, mineClock: 2.5, mines: [], momentumTime: 0, signalStep: 0, signalHp: 0, signalPower: 0, signalChoices: [], finalStep: 0, logs: [], npc: { spawned: false, state: 'none', x: 0, y: 0, still: 0, encounterPending: false, secretPending: false, silenced: false } };
}

const makeArsenal=()=>({version:1,states:{},fields:[],tracks:[]});

export { makeJourney, makeDirector, makeArsenal, createRun };
