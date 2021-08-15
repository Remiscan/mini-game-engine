import * as GEM from '../game-engine.min.js';



// User controls
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



// Initial state
const state = {
  jumpFrames: 0,
  startTime: performance.now()
};



// Game loop functions
const start = function(){};
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

  state.startTime = endTime;

  return state;
};



// Game levels
const game = new GEM.Game(start, update, { tickRate: 4, actions, state });
const level0 = game.addLevel({
  id: 'test0'
});
level0.addObject({
  width: game.width,
  height: game.height,
  draw: canvas => {
    canvas.fillStyle = 'black';
    canvas.fillRect(0, 0, game.width, game.height);
  }
});
console.log(game.levels);
game.loadLevel('test0');



// Page interface
const buttonPlay = document.querySelector('.load-game');
buttonPlay.addEventListener('click', () => { buttonPlay.remove(); game.play(); });
const buttonPause = document.querySelector('.pause-game');
buttonPause.addEventListener('click', () => game.paused = !game.paused);