import {createDialKit} from './vendor/dialkit/index.js';
import {fetchControls} from './fetch.js';
export async function mountCharacterDial(scene,game) {
  const controls = {
    'Character size': ['subject', .5, 3, .05],
    'Route left / right (px)': ['routeX', -150, 1000, 5],
    'Route near / far (m)': ['routeDepth', -4, 4, .05],
    'Height above ground (m)': ['footHeight', -.25, .75, .01],
    'Walking speed (×)': ['walkSpeed', .25, 3, .05],
    'Pause after photo (s)': ['photoPause', 0, 5, .05]
  };
  const config = {};
  for (const [label,[key,min,max,step]] of Object.entries(controls)) {
    config[label] = [scene[key],min,max,step];
  }
  const kit=createDialKit('Photographer',config,{
    id:'photographer',persist:{key:'ridge-photographer-size-v5'}
  });
  function apply(values) {
    for (const [label,[key]] of Object.entries(controls)) {
      if (Number.isFinite(values[label])) scene[key]=values[label];
    }
  }
  apply(kit.getValues());
  kit.subscribe(apply);
  const fetchKit=createDialKit('Fetch',{Dog:{...fetchControls.Dog},Ball:{...fetchControls.Ball},Replay:{type:'action',label:'Replay opening throw'}},{
    id:'greyhound-fetch',persist:{key:'greyhound-fetch-v4'},onAction:()=>game.replay()
  });
  function applyFetch(values){
    Object.assign(game.settings.Dog,values.Dog);
    Object.assign(game.settings.Ball,values.Ball);
  }
  applyFetch(fetchKit.getValues());
  fetchKit.subscribe(applyFetch);
}
