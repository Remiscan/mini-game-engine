import * as GEM from '../game-engine.min.js';



/* Set game canvas size to a multiple of the cell size. */
const cellSize = 64;
const canvas = document.querySelector('canvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

class Star {
  constructor(row, column) {
    const r = Math.round(2 * Math.random());
    this.size = r;
    this.type = r == 0 ? 'blue' : r == 1 ? 'yellow' : 'red';
    this.position = {
      x: 64 * column,
      y: 64 * row,
      z: 1
    };
    const maxDecalage = 20;
    this.decalage = {
      x: 32 - maxDecalage + Math.round(2 * maxDecalage * Math.random()),
      y: 32 - maxDecalage + Math.round(2 * maxDecalage * Math.random())
    };
  }

  get params() {
    return {
      width: 64,
      height: 64,
      position: this.position,
      draw: function(canvas) {
        canvas.imageSmoothingEnabled = true;
        canvas.beginPath();
        /*canvas.arc(
          this.position.x + 32 - maxDecalage + Math.round(2 * maxDecalage * Math.random()), // x
          this.position.y + 32 - maxDecalage + Math.round(2 * maxDecalage * Math.random()), // y
          4 + 4 * this.size, // r
          0, 2 * Math.PI
        );*/
        canvas.arc(
          this.position.x + this.state.decalage.x, // x
          this.position.y + this.state.decalage.y, // y
          8 + 2 * this.state.size, // r
          0, 2 * Math.PI
        );
        //canvas.fillStyle = `hsl(${this.state.size === 0 ? 200 : this.state.size === 1 ? 40 : 10}, 40%, 80%)`;
        canvas.fillStyle = this.state.size === 0 ? '#FFCF6E' // small red star
                         : this.state.size === 1 ? '#FFFFCF' // medium yellow star
                         : '#D7E0FF'; // big blue star
        canvas.fillStyle += '55';
        canvas.fill();
      }
    }
  }
}



/* Prepare the game */
const start = async function() {
  console.log('[Start] Starting...');

  this.state.jumpFrames = 0;

  // User controls
  this.addActions(new Map([
    ['jump', ['Space']]
  ]));

  const level0 = this.addLevel({
    id: 'test0',
    width: Math.floor(window.innerWidth / cellSize) * cellSize,
    height: Math.floor(window.innerHeight / cellSize) * cellSize
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
      canvas.imageSmoothingEnabled = false;
      if (this.state.facingRight) {
        canvas.translate(game.width, 0);
        canvas.scale(-1, 1);
        canvas.drawImage(sprite, game.width - x, y, -this.width, this.height);
      }
      else canvas.drawImage(sprite, x, y, this.width, this.height);
    }
  });

  // Star field
  const spread = 3;
  for (let row = 0; row < Math.floor(window.innerHeight / cellSize) / spread; row++) {
    for (let col = 0; col < Math.floor(window.innerWidth / cellSize) / spread; col++) {
      /*const r = Math.round(3 * Math.random());
      if (r > 0) continue;*/
      const star = new Star(row * spread + Math.round((spread - 1) * Math.random()), col * spread + Math.round((spread - 1) * Math.random()));
      const starObj = level0.addObject(star.params);
      starObj.state.decalage = star.decalage;
      starObj.state.size = star.size;
    }
  }

  await this.loadLevel('test0');

  console.log('[Start] Done ✅');
  return;
};



/* Game loop */
const update = function(ticks) {
  // Count the number of frames the user performed the 'jump' action
  if (this.state.actions.has('jump')) { this.state.jumpFrames++; }
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
      x: (-this.state.actions.has('left') + this.state.actions.has('right')) * ticks,
      y: (-this.state.actions.has('up') + this.state.actions.has('down')) * ticks
    };
    if (direction.x > 0) player.state.facingRight = true;
    else if (direction.x < 0) player.state.facingRight = false;
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