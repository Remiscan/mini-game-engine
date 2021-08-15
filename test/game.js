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
const start = async function() {
  const level0 = this.addLevel({
    id: 'test0'
  });

  level0.addObject({
    width: this.width,
    height: this.height,
    draw: canvas => {
      canvas.fillStyle = 'black';
      canvas.fillRect(0, 0, this.width, this.height);
    }
  });

  console.log(this.levels);
  await this.loadLevel('test0');
  return;
};

const update = function(ticks) {
  const endTime = performance.now();
  console.log(`New tick after ${endTime - this.state.startTime} ms`);

  console.log('Actions:', this.state.actions);
  console.log('Objects:', this.state.level.objects);

  if (this.state.actions.includes('Jump')) { this.state.jumpFrames++; }
  else {
    if (this.state.jumpFrames > 0) {
      console.log(`Jumped for ${this.state.jumpFrames} ticks`);
      this.state.jumpFrames = 0;
    }
  }

  this.state.startTime = endTime;
};



const game = new GEM.Game(start, update, [], { tickRate: 4, actions, state });



// Page interface
const buttonPlay = document.querySelector('.load-game');
buttonPlay.addEventListener('click', () => { buttonPlay.remove(); game.play(); });
const buttonPause = document.querySelector('.pause-game');
buttonPause.addEventListener('click', () => game.paused = !game.paused);