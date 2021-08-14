import * as GEM from '../game-engine.min.js';



let startTime;

const actions = [
  {
    name: 'Jump',
    controls: ['Space']
  }, {
    name: 'Up',
    controls: ['ArrowUp', 'KeyW']
  }, {
    name: 'Down',
    controls: ['ArrowDown', 'KeyS']
  }, {
    name: 'Left',
    controls: ['ArrowLeft', 'KeyA']
  }, {
    name: 'Right',
    controls: ['ArrowRight', 'KeyD']
  }
];

const state = {
  jumpFrames: 0,
  startTime: performance.now()
};



const start = function() {
  
};


const update = function(state, actions, ticks) {
  const endTime = performance.now();
  console.log(`New tick after ${endTime - state.startTime} ms`);

  console.log('Actions:', actions);

  if (actions.includes('Jump')) { state.jumpFrames++; }
  else {
    if (state.jumpFrames > 0) {
      console.log(`Jumped for ${state.jumpFrames} ticks`);
      state.jumpFrames = 0;
    }
  }

  startTime = endTime;

  return state;
};


const game = new GEM.Game(start, update, { tickRate: 4, actions, state });
game.play();


window.addEventListener('click', () => game.paused = !game.paused);