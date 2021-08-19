/**
 * @class Game.
 */
export class Game {
  /**
   * Builds a new game.
   * @param {function} start - The function executed on game launch.
   * @param {function} update - The function executed on each frame.
   * @param {object} params
   * @param {Element} params.canvas - The canvas on which all game objects will be drawn.Node
   * @param {Element} params.html - The container of all HTML elements that will be displayed over the canvas, (e.g. for accessible text or buttons).
   * @param {number} params.tickRate - The number of times the game state will be updated per second.
   */
  constructor(start = function(){}, update = function(){}, {
    canvas = document.querySelector('canvas'),
    html = document.querySelector('accessible-elements'),
    tickRate = 60,
  } = {}) {
    this.canvas = canvas.getContext('2d');
    this.html = html;

    this.width = canvas.width;
    this.height = canvas.height;
    this.audioCtx = null;
    this.paused = false;
    this.mute = false;
    this.levels = [];
    this.assets = [];

    // Default actions
    this.actions = {
      up: ['ArrowUp', 'KeyW'],
      down: ['ArrowDown', 'KeyS'],
      left: ['ArrowLeft', 'KeyA'],
      right: ['ArrowRight', 'KeyD']
    };

    this.controls = {};
    for (const action of Object.keys(this.actions)) {
      for (const control of this.actions[action]) {
        this.controls[control] = false;
      }
    }

    // State of the game, used to compute what to display on the next frame
    this.state = {};
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
   * @param {DOMHighResTimeStamp} frameTime - Time at which the rendering started.
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
    const orderedObjects = [...this.state.level.objects].sort((a, b) => a.z < b.z ? -1 : a.z > b.z ? 1 : 0);
    // Draw all objects from the current level
    for (const obj of orderedObjects) {
      this.canvas.save();

      // Don't display what's outside the level or camera view
      let border = new Path2D();
      border.rect(
        Math.max(0, -camera.x),
        Math.max(0, -camera.y),
        Math.min(obj.level.width, this.width),
        Math.min(obj.level.height, this.height)
      );
      this.canvas.clip(border);

      // Move screen depending on camera view
      this.canvas.translate(-camera.x, -camera.y);

      obj.draw(this.canvas, { x: obj.position.x, y: obj.position.y, game: this });
      this.canvas.restore();
    }

    this.rendering = false;
    //console.log('[Render] Done ✅');
  }

  
  /**
   * Add new user controlled actions.
   * @param {Action} actions - Object whose keys are action names, and values are an array of user controls.
   */
  addActions(actions) {
    this.actions = Object.assign(this.actions, actions);
  }


  /**
   * Add a sound asset to the level
   * @param {string} id - Identifier of the asset.
   * @param {string} path - Path of the asset.
   */
   addSound(id, path) { this.assets.push({ type: 'sound', id, path }); }


   /**
    * Add an image asset to the level
    * @param {string} id - Identifier of the asset.
    * @param {string} path - Path of the asset.
    */
   addImage(id, path) { this.assets.push({ type: 'image', id, path }); }


  /**
   * Adds a level to the game.
   * @param {object} params - Parameters of the level.
   * @returns {Level} The added level.
   */
  addLevel(params) {
    const lev = new Level(this, params);
    this.levels.push(lev);
    return lev;
  }


  /**
   * Loads a level, its sprites and its sounds.
   * @param {string} id - Identifier of the level to load.
   */
  async loadLevel(id) {
    this.pause = true;
    const newLevel = this.levels.find(level => level.id === id);
    await newLevel.load();
    this.state.level = newLevel;
    this.pause = false;
  }


  /**
   * Plays a sound.
   * @param {string} id - Identifier of the sound to play.
   */
  playSound(id) {
    if (this.mute) return;

    const sound = this.audioCtx.createBufferSource();
    const data = this.assets.find(s => s.id == id)?.data;
    if (typeof data === 'undefined') throw `Sound ${id} doesn't exist`;
    sound.buffer = data;
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
 */
export class Level {
  /**
   * Create a new game level.
   * @param {Game} game - The game this level will belong to.
   * @param {object} params - Parameters of the level.
   * @param {string?} params.id - Identifier of the level.
   * @param {number?} params.width - Width of the level, in pixels.
   * @param {number?} params.height - Height of the level, in pixels.
   */
  constructor(game, {
    id = null,
    width = null,
    height = null,
  } = {}) {
    this.game = game;
    this.id = id || game.levels.length;
    this.width = width || game.width;
    this.height = height || game.height;
    this.objects = new Set();
    this.camera = {
      x: this.width < game.width ? (this.width - game.width) / 2 : 0,
      y: this.height < game.height ? (this.height - game.height) / 2 : 0,
      z: 0,
      perspective: 0
    };
    this.audioCtx = game.audioCtx;
  }


  /** Preloads all assets of the level. */
  async load() {
    // Get the list of assets used in the new level
    const assets = new Set();
    for (const obj of this.objects) {
      for (const asset of obj.assets) {
        assets.add(asset);
      }
    }

    // Load assets
    await Promise.all([...assets].map(async asset => {
      if (!!asset.data) return asset.data;
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
      return asset.data = response;
    }));

    const oldLevel = this.game.state.level;
    if (oldLevel instanceof Level) {
      // Get the list of assets used in the old level
      const oldAssets = new Set();
      for (const obj of oldLevel.objects) {
        for (const asset of obj.assets) {
          oldAssets.add(asset);
        }
      }

      // Unload old assets
      for (const asset of oldAssets) {
        if (!assets.has(asset)) asset.data = null;
      }
    }
    
    return;
  }


  /**
   * Adds a GameObject to the level.
   * @param {object} params - The parameters of the GameObject.
   * @returns {GameObject} The added object.
   */
  addObject(params) {
    const spr = new GameObject(this, params);
    this.objects.add(spr);
    return spr;
  }


  /*getObject(id) {
    return this.objects.find(o => o.id === id);
  }*/


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
    }
  }
}





/**
 * @class GameObject.
 */
export class GameObject {
  /**
   * Create a new GameObject.
   * @param {Level} level - The level that will contain the object.
   * @param {object} params - The object parameters.
   * @param {string} params.id - Identifier of the object.
   * @param {object} params.position - Position of the object.
   * @param {number} params.position.x - Horizontal position.
   * @param {number} params.position.y - Vertical position.
   * @param {number} params.position.z - Elevation. The object will appear over other objects with lower elevations.
   * @param {number} params.maxSpeed - Maximum number of pixels per tick the object can move.
   * @param {number} params.width - Width of the object.
   * @param {number} params.height - Height of the object.
   * @param {string[]} params.assets - List of identifiers of assets used by this object.
   * @param {Function} params.draw - Function that draws the object onto the game canvas.
   * @param {boolean} params.collision - Whether the object can collide with other objects.
   * @param {boolean} params.damage - Whether the object can inflict damage to other objects.
   * @param {boolean} params.controllable - Whether the object can react to some user actions.
   */
  constructor(level, {
    id = null,
    position = {
      x: 0,
      y: 0,
      z: 0
    },
    maxSpeed = 0,
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
    this.maxSpeed = maxSpeed; // pixels per tick
    this.speed = { x: 0, y: 0 }; // pixels per tick
    this.angle = 0;
    this.state = {};

    this.width = width;
    this.height = height;
    this.draw = draw.bind(this);

    this.collision = collision;
    this.damage = damage;
    this.controllable = controllable;

    this.assets = this.game.assets.filter(a => assets.includes(a.id));
  }


  /**
   * Moves an object (single frame).
   * @param {object} options - Movement options.
   * @param {boolean} apply - Whether to actually move the object or not.
   * @returns {object} The position the object would have after moving.
   */
  move({ apply = true } = {}) {
    const oldPosition = Object.assign({}, this.position);
    const width = this.width, height = this.height;

    let x = this.position.x + this.speed.x;
    let y = this.position.y + this.speed.y;

    // Send a player ghost to the new position and check if it collides with something
    const tempXY = new GameObject(this.level, { position: { x, y }, width, height, collision: true });
    const collisionsXY = tempXY.allCollisions({ exclude: [this] });    
    const collidesXY = collisionsXY.length > 0;

    // If the ghost collided with something, close the distance then stop moving in the blocking direction(s)
    if (collidesXY) {
      // Close the distance between the object and the closest blocking object
      const distances = collisionsXY.map(obj => this.distanceTo(obj));
      const minDistance = { x: Math.min(distances.map(d => d.x)), y: Math.min(distances.map(d => d.y)) };
      x += minDistance.x;
      y += minDistance.y;

      // Check if one direction is still unblocked
      const tempX = new GameObject(this.level, { position: { x, y: oldPosition.y }, width, height, collision: true });
      const tempY = new GameObject(this.level, { position: { x: oldPosition.x, y }, width, height, collision: true });
      const collidesX = tempX.allCollisions({ exclude: [this] }).length > 0;
      const collidesY = tempY.allCollisions({ exclude: [this] }).length > 0;

      // Only keep the speed component in the unblocked direction(s)
      if (collidesX && !collidesY)      x -= this.speed.x;
      else if (collidesY && !collidesX) y -= this.speed.y;
      else x -= this.speed.x, y -= this.speed.y;
    }

    if (apply) this.position = Object.assign(this.position, { x, y });
    return { x, y };
  }


  /**
   * Move the object towards the direction given by a vector.
   * @param {object} vector - Direction vector.
   * @param {number} vector.x - Horizontal distance to travel.
   * @param {number} vector.y - Vertical distance to travel.
   * @param {object} options - Movement options.
   */
  moveByVector({ x, y }, options) {
    const cos = x / Math.sqrt(x**2 + y**2);
    const sin = y * Math.sqrt(1 - cos**2);
    const max = this.maxSpeed;

    this.speed = {
      x: max * cos,
      y: max * sin
    };
    return this.move(options);
  }


  /**
   * Determines if there is collision between two objects.
   * @param {GameObject} obj - The object to check collision with.
   * @return {boolean} Whether there is a collision.
   */
  collidesWith(obj) {
    if (
      (
        (this.position.x <= obj.position.x && this.position.x + this.width > obj.position.x)
        || (this.position.x < obj.position.x + obj.width && this.position.x + this.width >= obj.position.x + obj.width)
      ) && (
        (this.position.y <= obj.position.y && this.position.y + this.height > obj.position.y)
        || (this.position.y < obj.position.y + obj.height && this.position.y + this.height >= obj.position.y + obj.height)
      )
    ) return true;
    return false;
  }


  /**
   * Returns a list of objects that collide with this object.
   * @param {object} options
   * @param {GameObject[]} options.exclude - List of game objects to ignore.
   * @param {boolean} options.forceCollision - Whether to force the collision, even if one of the objects is not collision-able.
   * @return {GameObject[]} List of objects colliding with this object.
   */
  allCollisions({ exclude = [], forceCollision = false } = {}) {
    const cols = [];
    for (const obj of this.level.objects) {
      if (obj === this || exclude.includes(obj)) continue;
      if (!forceCollision && (!this.collision || !obj.collision)) continue;
      if (this.collidesWith(obj)) cols.push(obj);
    }
    return cols;
  }


  /**
   * Distance from this to an object.
   * @param {GameObject} - The object used to compute the distance between it and this.
   * @return {object} The computed distance along each axis.
   */
  distanceTo(obj) {
    let dx = 0, dy = 0;
    // If the objects collide, distance is zero. If not, it's equal to the number of pixels
    // between the closest borders of each object along each axis.
    if (!this.collidesWith(obj)) {
      if (obj.position.x + obj.width < this.position.x)        dx = (obj.position.x + obj.width) - this.position.x;
      else if (this.position.x + this.width < obj.position.x)  dx = obj.position.x - (this.position.x + this.width);
      if (obj.position.y + obj.height < this.position.y)       dy = (obj.position.y + obj.height) - this.position.y;
      else if (this.position.y + this.height < obj.position.y) dy = obj.position.y - (this.position.y + this.height);
    }
    return { x: dx, y: dy };
  }
}






/** TYPE DEFINITIONS */

/**
 * Game action, with a name and a list of associated controls.
 * @typedef {Object} Action
 * @property {string} name - Name of the action (example: 'jump');
 * @property {string[]} controls - List of controls / button codes associated with that action (example: ['A', 'Space']);
 */