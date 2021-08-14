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
  jumpFrames: 0
};



const start = function() {
  startTime = Date.now();
};


const update = function() {
  const endTime = Date.now();
  console.log(`New frame after ${endTime - startTime} ms`);

  const currentActions = this?.currentActions;
  console.log(currentActions);

  if (currentActions.includes('Jump')) { this.state.jumpFrames++; }
  else {
    if (this.state.jumpFrames > 0) {
      console.log(`Jumped for ${this.state.jumpFrames} frames`);
      this.state.jumpFrames = 0;
    }
  }

  startTime = endTime;
};


const game = new GEM.Game(start, update, { frameRate: 4, actions, state });
game.play();


window.addEventListener('click', () => game.paused = !game.paused);