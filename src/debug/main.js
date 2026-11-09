import { createDebugGame } from './create-debug-game.js';
import { readDebugOptions } from './combat-inspector.js';

const options=readDebugOptions('?debug=1&'+location.search.replace(/^\?/,''));
const app=createDebugGame({seed:options.seed??42});
globalThis.fieldSurvivorDebug=app;

const dispose=app.dispose;app.dispose=()=>{dispose();if(globalThis.fieldSurvivorDebug===app)delete globalThis.fieldSurvivorDebug;};
