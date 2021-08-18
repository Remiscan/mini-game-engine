import * as GEM from '../game-engine.js';



/* Prepare the game */
const start = async function() {
  console.log('[Start] Starting...');

  this.state.jumpFrames = 0;

  // User controls
  this.addActions({
    jump: ['Space']
  });

  const level0 = this.addLevel({
    id: 'test0',
    /*width: 200,
    height: 200*/
  });

  // Black background
  level0.addObject({
    width: level0.width,
    height: level0.height,
    draw: function(canvas) {
      canvas.fillStyle = 'black';
      canvas.fillRect(0, 0, this.width, this.height);
    }
  });

  // Red square
  level0.addObject({
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
  this.addImage('boole', 'assets/boole1.png');
  this.addSound('bump', 'assets/ouch.mp3');
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
    assets: ['boole', 'bump'],
    draw: function(canvas, { x, y, game }) {
      const sprite = this.assets.find(a => a.id === 'boole').data;
      console.log(game.assets, this.assets);
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



/* Game loop */
const update = function(ticks) {
  // Count the number of frames the user performed the 'jump' action
  if (this.state.actions.includes('jump')) { this.state.jumpFrames++; }
  else {
    if (this.state.jumpFrames > 0) {
      console.log(`Jumped for ${this.state.jumpFrames} ticks`);
      this.state.jumpFrames = 0;
    }
  }

  // Move all playable objects
  const players = [...this.state.level.objects].filter(obj => obj.controllable);
  for (const player of players) {
    const oldPosition = Object.assign({}, player.position);

    // Determine object speed depending on pressed controls (in pixels per tick)
    const direction = {
      x: (-this.state.actions.includes('left') + this.state.actions.includes('right')) * ticks,
      y: (-this.state.actions.includes('up') + this.state.actions.includes('down')) * ticks
    };
    if (direction.x === 0 && direction.y === 0) {
      player.state.bumped = false;
      continue;
    }

    // Move the object
    const movedTo = player.moveByVector(direction);

    // Play a sound when the object collides with another
    if (movedTo.x === oldPosition.x && movedTo.y === oldPosition.y) {
      if (!player.state.bumped) this.playSound('bump');
      player.state.bumped = true;
    }
  }
};



const game = new GEM.Game(start, update, { tickRate: 60 });



// Page interface
const buttonPlay = document.querySelector('.load-game');
buttonPlay.addEventListener('click', () => { buttonPlay.remove(); game.play(); });
const buttonPause = document.querySelector('.pause-game');
buttonPause.addEventListener('click', () => game.paused = !game.paused);