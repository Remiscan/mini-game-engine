import * as GEM from '../game-engine.js';



let player, rect;



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

  level0.addImage('boole', 'assets/boole1.png');

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
  rect = level0.addObject({
    id: 'rect',
    width: 32,
    height: 32,
    position: {
      x: 64,
      y: 64
    },
    collision: true,
    draw: function(canvas) {
      if (this.allCollisions().length > 0) canvas.fillStyle = 'red';
      else                                 canvas.fillStyle = 'blue';
      canvas.fillRect(this.position.x, this.position.y, this.width, this.height);
    }
  });

  // Boole the frog
  level0.addObject({
    id: 'player',
    width: 32,
    height: 32,
    position: {
      x: 32,
      y: 128
    },
    maxSpeed: 5,
    controllable: true,
    collision: true,
    assets: ['boole'],
    draw: function(canvas, { x, y, game }) {
      const sprite = this.assets.find(a => a.id === 'boole').data;
      canvas.imageSmoothingEnabled = false;
      if (this.angle > -Math.PI / 2 && this.angle < Math.PI / 2) {
        canvas.translate(game.width, 0);
        canvas.scale(-1, 1);
        canvas.drawImage(sprite, game.width - x, y, -this.width, this.height);
      }
      else canvas.drawImage(sprite, x, y, this.width, this.height);
    }
  });

  await this.loadLevel('test0');

  console.log('[Start] Done ✅');
  return;
};

const update = function(ticks) {
  const endTime = performance.now();
  //console.log(`[Update] New tick after ${endTime - this.state.startTime} ms`);

  //console.log('Actions:', this.state.actions);
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
    // Determine object speed depending on pressed controls (in pixels per tick)
    const direction = {
      x: (-this.state.actions.includes('left') + this.state.actions.includes('right')) * ticks,
      y: (-this.state.actions.includes('up') + this.state.actions.includes('down')) * ticks
    };
    if (direction.x === 0 && direction.y === 0) continue;

    player.moveByVector(direction);
  }

  this.state.startTime = endTime;
  //console.log('[Update] Done ✅');
};



const game = new GEM.Game(start, update, [], { tickRate: 60, actions, state });



// Page interface
const buttonPlay = document.querySelector('.load-game');
buttonPlay.addEventListener('click', () => { buttonPlay.remove(); game.play(); });
const buttonPause = document.querySelector('.pause-game');
buttonPause.addEventListener('click', () => game.paused = !game.paused);