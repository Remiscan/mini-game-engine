import * as GEM from '../game-engine.js';



// User controls
const actions = {
  jump: ['Space']
};



// Initial state
const state = {
  jumpFrames: 0,
  startTime: performance.now()
};



// Game loop functions
const start = async function() {
  console.log('[Start] Starting...');

  const level0 = this.addLevel({
    id: 'test0'
  });

  // Black background
  level0.addObject({
    width: this.width,
    height: this.height,
    draw: function(canvas) {
      canvas.fillStyle = 'black';
      canvas.fillRect(0, 0, this.width, this.height);
    }
  });

  // Red square
  level0.addObject({
    width: 32,
    height: 32,
    position: {
      x: 32,
      y: 32
    },
    controllable: true,
    draw: function(canvas) {
      canvas.fillStyle = 'red';
      canvas.fillRect(this.position.x, this.position.y, this.width, this.height);
    }
  });

  await this.loadLevel('test0');

  console.log('[Start] Done ✅');
  return;
};

const update = function(ticks) {
  const endTime = performance.now();
  console.log(`[Update] New tick after ${endTime - this.state.startTime} ms`);

  console.log('Actions:', this.state.actions);
  //console.log('Left:', this.actions.find(a => a.name == 'Left'));

  if (this.state.actions.includes('jump')) { this.state.jumpFrames++; }
  else {
    if (this.state.jumpFrames > 0) {
      console.log(`Jumped for ${this.state.jumpFrames} ticks`);
      this.state.jumpFrames = 0;
    }
  }

  const players = this.state.level.objects.filter(obj => obj.controllable);
  for (const player of players) {
    if (this.state.actions.includes('left') || this.state.actions.includes('right') || this.state.actions.includes('up') || this.state.actions.includes('down')) {
      console.log('Old position:', player.position);
      let x = player.position.x, y = player.position.y;
      const speed = 5; // pixels per tick
      if (this.state.actions.includes('left')) x = x - speed;
      if (this.state.actions.includes('right')) x = x + speed;
      if (this.state.actions.includes('up')) y = y - speed;
      if (this.state.actions.includes('down')) y = y + speed;
      player.position = {
        x: Math.max(0, Math.min(x, this.width - player.width)),
        y: Math.max(0, Math.min(y, this.height - player.height))
      };
      console.log('New position:', player.position);
    }
  }

  this.state.startTime = endTime;
  console.log('[Update] Done ✅');
};



const game = new GEM.Game(start, update, [], { tickRate: 60, actions, state });



// Page interface
const buttonPlay = document.querySelector('.load-game');
buttonPlay.addEventListener('click', () => { buttonPlay.remove(); game.play(); });
const buttonPause = document.querySelector('.pause-game');
buttonPause.addEventListener('click', () => game.paused = !game.paused);