/**
 * @class Game.
 */
export class Game {
  /**
   * Builds a new game.
   * @param {function} start - The function executed on game launch.
   * @param {function} update - The function executed on each frame.
   * @param {object} options
   * @param {Element} options.canvas - The canvas on which all game objects will be drawn.Node
   * @param {Element} options.html - The container of all HTML elements that will be displayed over the canvas, for example for accessible text or buttons.
   * @param {object} options.state - The initial state data of the game.
   * @param {Action} options.actions - The list of actions and their associated controls.
   * @param {Level} options.levels - The list of game levels.
   * @param {number} options.tickRate - The number of frames that will be computed per second.
   */
  constructor(start = function(){}, update = function(){}, functions = [], {
    canvas = document.querySelector('canvas'),
    html = document.querySelector('accessible-elements'),
    state = {},
    actions = {},
    levels = [],
    tickRate = 60,
  } = {}) {
    this.canvas = canvas.getContext('2d');
    this.html = html;

    this.width = canvas.width;
    this.height = canvas.height;
    this.audioCtx = null;
    this.paused = false;
    this.mute = false;
    this.levels = levels;

    const defaultActions = {
      up: ['ArrowUp', 'KeyW'],
      down: ['ArrowDown', 'KeyS'],
      left: ['ArrowLeft', 'KeyA'],
      right: ['ArrowRight', 'KeyD']
    };
    this.actions = Object.assign(defaultActions, actions);

    this.controls = {};
    for (const action of Object.keys(this.actions)) {
      for (const control of this.actions[action]) {
        this.controls[control] = false;
      }
    }

    // State of the game, used to compute what to display on the next frame
    this.state = state;
    this.state.level = null;
    this.state.actions = [];
    
    // Function executed on game launch.
    this.start = start.bind(this);

    /* 🔽 Manage game loop 🔽 */

    this.tickRate = tickRate;
    const tickDuration = 1000 / this.tickRate;
    this.computing = false;
    this.rendering = false;

    // Request an update to the game state.
    const requestUpdates = ticks => {
      if (ticks <= 0) return;
      if (this.computing) return;
      this.computing = true;
      this.lastTick += ticks * tickDuration;
      this.state.actions = this.currentActions;
      update.bind(this)(ticks); // if async, won't block rendering
      this.computing = false;
    };

    // Game loop (inspired by https://developer.mozilla.org/en-US/docs/Games/Anatomy).
    // On each frame:
    // - request an update to the game state,
    // - render the current game state.
    function gameLoop(frameTime) {
      this.stopLoop = window.requestAnimationFrame(gameLoop.bind(this));
      if (this.paused) return;

      const nextTick = this.lastTick + tickDuration;
      let ticks = 0;
      if (frameTime > nextTick) {
        const elapsed = frameTime - this.lastTick;
        ticks = Math.floor(elapsed / tickDuration);
      }

      requestUpdates(ticks);
      this.render(frameTime);
    }

    this.gameLoop = gameLoop.bind(this);

    /* 🔼 End of game loop management 🔼 */
  }


  /** Starts the game. */
  async play() {
    this.initControls();
    this.audioCtx = new (AudioContext || webkitAudioContext)();

    this.lastTick = performance.now();
    this.lastRender = this.lastTick;

    await this.start();
    if (!(this.state.level instanceof Level)) throw 'No level loaded';
    this.gameLoop(performance.now());
  }


  /**
   * Renders the game.
   * @param {DOMHighResTimeStamp} frameTime - Can be used to interpolate.
   */
  render(frameTime) {
    if (this.rendering) return;
    //console.log('[Render] Starting...');
    this.rendering = true;
    this.lastRender = frameTime;

    // Clears the previous frame
    this.canvas.clearRect(0, 0, this.width, this.height);

    const camera = this.state.level.camera;
    // Sort objects by their elevation (z)
    const orderedObjects = this.state.level.objects.sort((a, b) => a.z < b.z ? -1 : a.z > b.z ? 1 : 0);
    // Draw all objects from the current level
    for (const obj of orderedObjects) {
      // Compute the position of the object in the current camera view
      const posX = obj.position.x - camera.x;
      const posY = obj.position.y - camera.y;
      // Don't draw an object that's outside of the camera view
      if (posX < -obj.width || posY < -obj.height || posX > this.width || posY > this.height) continue;
      this.canvas.save();
      obj.draw(this.canvas, { x: posX, y: posY, game: this });
      this.canvas.restore();
    }

    this.rendering = false;
    //console.log('[Render] Done ✅');
  }


  /**
   * Adds a level to the game.
   * @param {...any} args 
   */
  addLevel(options) {
    const lev = new Level(this, options);
    this.levels.push(lev);
    return lev;
  }


  /**
   * Loads a level, its sprites and its sounds.
   * @param {string} id - Identifier of the level.
   */
  async loadLevel(id) {
    this.pause = true;
    const lev = this.levels.find(level => level.id === id);
    await lev.load();
    this.state.level = lev;
    this.pause = false;
  }


  /**
   * Plays a sound.
   * @param {string} id - Identifier of the sound.
   */
  playSound(id) {
    if (this.mute) return;

    const sound = this.audioCtx.createBufferSource();
    const k = this.state.level.sounds.findIndex(s => s.id == id);
    if (k == -1) throw `Sound ${id} doesn't exist`;
    sound.buffer = this.state.level.sounds[k].sound;
    sound.connect(this.audioCtx.destination);
    sound.start();
  }


  /** Pauses the game by pausing the update function. */
  pause() { this.paused = true; }

  /** Unpauses the game by unpausing the update function. */
  unpause() { this.paused = false; }


  /** Initializes detection of button presses. */
  initControls() {
    // Detect keydown events and update the list of controls.
    document.addEventListener('keydown', event => {
      if (event.repeat) return;
      //console.log('keydown', event);
      const id = event.code || event.key;
      if (typeof this.controls[id] === undefined) return;
      this.controls[id] = true;
    });

    // Detect keyup events and update the list of controls.
    document.addEventListener('keyup', event => {
      //console.log('keyup', event);
      const id = event.code || event.key;
      if (typeof this.controls[id] === undefined) return;
      this.controls[id] = false;
    });
  }


  /** @returns {Array} The list of currently active actions. */
  get currentActions() {
    const allActions = Object.keys(this.actions);
    const active = new Set();
    for (const action of allActions) {
      for (const key of this.actions[action]) {
        if (this.controls[key] === true) active.add(action);
      }
    }
    return [...active];
  }
}



/**
 * @class Game level object.
 * @property {object} sprites - The list of sprites used in the level.
 * @property {object} sounds - The list of sounds used in the level.
 * @property {AudioContext|webkitAudioContext} audioCtx - The audio context.
 */
export class Level {
  constructor(game, {
    id = null,
    width = null,
    height = null,
  } = {}) {
    this.game = game;
    this.id = id || game.levels.length;
    this.width = width || game.width;
    this.height = height || game.height;
    this.objects = [];
    this.assets = [];
    this.camera = { x: 0, y: 0, z: 0, angle: 0, perspective: 0 };
    this.audioCtx = game.audioCtx;
  }

  async load() {
    // Load assets
    return await Promise.all(this.assets.map(async asset => {
      let response = await fetch(asset.path);
      switch (asset.type) {
        case 'sound': {
          response = await response.arrayBuffer();
          response = await this.audioCtx.decodeAudioData(response);
        } break;
        case 'image': {
          response = await response.blob();
          response = await createImageBitmap(response);
        } break;
      }
      if (asset.type === 'sound') {
        response = await response.arrayBuffer();
        response = await this.audioCtx.decodeAudioData(response);
      }
      return asset.data = response;
    }));
    /*let responses = await Promise.all(this.sounds.map(sound => fetch(`./assets/${sound}.mp3`)));
    responses = await Promise.all(responses.map(r => r.arrayBuffer()));
    responses = await Promise.all(responses.map(r => audioCtx.decodeAudioData(r)));
    this.sounds = this.sounds.map((id, k) => { return { id: id, sound: responses[k] } });
    return;*/
  }

  addObject(options) {
    const spr = new GameObject(this, options);
    this.objects.push(spr);
    return spr;
  }

  getObject(id) {
    return this.objects.find(o => o.id === id);
  }

  addSound(id, path) { this.assets.push({ type: 'sound', id, path }); }
  addImage(id, path) { this.assets.push({ type: 'image', id, path }); }

  /**
   * Move the camera by moving all objects on the canvas.
   * @param {number} x - Horizontal coordinate of the top left corner of the camera view.
   * @param {number} y - Vertical coordinate of the top left corner of the camera view.
   * @param {number} z - Depth coordinate of the top left corner of the camera view.
   * @param {number} angle - Angle of rotation (in degrees) of the camera around the z axis.
   */
  moveCamera({ x, y, z = 0, angle = 0 } = {}) {
    const oldPosition = Object.assign({}, this.camera);
    this.camera = { x, y, z, angle };
    const moveBy = { x: oldPosition.x - this.camera.x, y: oldPosition.y - this.camera.y, z: oldPosition.z - this.camera.z, angle: oldPosition.angle - this.camera.angle };
    for (const obj of this.objects) {
      // Move obj by moveBy, maybe with an added variable for perspective?
      obj.moveTo(
        obj.position.x + moveBy.x,
        obj.position.y + moveBy.y,
        obj.position.z + moveBy.z
      );
    }
  }

  static objectsCollide(obj1, obj2) {
    if (
      (obj1.position.x + obj1.width < obj2.position.x)
      || (obj2.position.x + obj2.width < obj1.position.x)
      || (obj1.position.y + obj1.height < obj2.position.y)
      || (obj2.position.y + obj2.height < obj1.position.y)
    ) return false;
    return true;
  }
}



/**
 * @class GameObject.
 */
export class GameObject {
  constructor(level, {
    id = null,
    position = {
      x: 0,
      y: 0,
      z: 0
    },
    width = 0,
    height = 0,
    assets = [],
    draw = function(){},
    collision = false,
    damage = false,
    controllable = false,
  } = {}) {
    this.level = level;
    this.game = level.game;

    this.id = id;
    this.position = position;
    this.speed = 0; // pixels per tick
    this.maxSpeed = 5; // pixels per tick

    this.width = width;
    this.height = height;
    this.draw = draw.bind(this);

    this.collision = collision;
    this.damage = damage;
    this.controllable = controllable;

    this.assets = level.assets.filter(a => assets.includes(a.id));
  }

  /**
   * Computes the position of a moving object on next frame.
   * @param {number} x 
   * @param {number} y 
   * @param {number} z 
   */
  moveTo(x, y, z) {
    const angle = x === this.position.x ? (y > this.position.y ? Math.PI / 2 : -Math.PI / 2)
                : y === this.position.y ? (x > this.position.x ? 0 : Math.PI)
                : Math.atan(Math.PI / 180 * (y - this.position.y) / (x - this.position.x));
    
    return {
      x: this.position.x + Math.cos(angle) * this.maxSpeed,
      y: this.position.y + Math.sin(angle) * this.maxSpeed,
      z
    };
  }

  /**
   * Determines if there is collision between two objects.
   * @param {GameObject} obj 
   */
  collidesWith(obj) {
    return Level.objectsCollide(this, obj);
  }

  /** Returns a list of objects that collide with this object. */
  allCollisions() {
    const objects = this.level.objects;
    const cols = [];
    for (const obj of objects) {
      if (obj === this) continue;
      if (obj.collision === false) continue;
      if (this.collidesWith(obj)) cols.push(obj);
    }
    return cols;
  }
}



/** TYPE DEFINITIONS */

/**
 * Game action, with a name and a list of associated controls.
 * @typedef {Object} Action
 * @property {string} name - Name of the action (example: 'jump');
 * @property {string[]} controls - List of controls / button codes associated with that action (example: ['A', 'Space']);
 */