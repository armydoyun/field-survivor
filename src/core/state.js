import { initialProfile } from './profile.js';

let profile = initialProfile(), run = null;
function replaceRun(next) { run = next; }
function resetState() { profile = initialProfile(); run = null; }

export { profile, run, replaceRun, resetState };
