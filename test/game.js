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
      x: 32,
      y: 32
    },
    collision: true,
    draw: function(canvas) {
      const player = this.level.getObject('player');
      if (this.collidesWith(player)) canvas.fillStyle = 'red';
      else                           canvas.fillStyle = 'blue';
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
    controllable: true,
    collision: true,
    assets: ['boole'],
    draw: function(canvas, { x, y, game }) {
      const sprite = this.assets.find(a => a.id === 'boole').data;
      canvas.imageSmoothingEnabled = false;
      if (this.facingRight === true) {
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
    if (this.state.actions.includes('left') || this.state.actions.includes('right') || this.state.actions.includes('up') || this.state.actions.includes('down')) {
      //console.log('Old position:', player.position);
      let x = player.position.x, y = player.position.y;
      const speed = 5; // pixels per tick
      if (this.state.actions.includes('left')) x = x - speed;
      if (this.state.actions.includes('right')) x = x + speed;
      if (this.state.actions.includes('up')) y = y - speed;
      if (this.state.actions.includes('down')) y = y + speed;
      if (x > player.position.x)      player.facingRight = true;
      else if (x < player.position.x) player.facingRight = false;
      const oldPosition = player.position;
      const newPosition = {
        x: Math.max(0, Math.min(x, this.width - player.width)),
        y: Math.max(0, Math.min(y, this.height - player.height)),
      };
      const fp0 = new GEM.GameObject(player.level, player); fp0.position.x = newPosition.x; fp0.position.y = newPosition.y;
      const fp1 = new GEM.GameObject(player.level, player); fp1.position.x = newPosition.x;
      const fp2 = new GEM.GameObject(player.level, player); fp2.position.y = newPosition.y;

      player.position = fp0.allCollisions().length === 0 ? newPosition
                      : fp1.allCollisions().length === 0 ? np1.position
                      : fp2.allCollisions().length === 0 ? np2.position
                      : oldPosition;
      //console.log('New position:', player.position);
    }
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