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
  constructor(start = function(){}, update = function(){}, {
    canvas = document.querySelector('canvas'),
    html = document.querySelector('accessible-elements'),
    state = {},
    actions = {},
    levels = [],
    tickRate = 60
  } = {}) {
    this.canvas = canvas.getContext('2d');
    this.html = html;

    // State of the game, used to compute what to display on the next frame
    this.state = state;
    this.state.actions = actions;
    this.state.level = null;

    this.width = canvas.width;
    this.height = canvas.height;
    this.audioCtx = null;
    this.paused = false;
    this.mute = false;
    this.levels = levels;
    
    // Function executed on game launch.
    this.start = start.bind(this);

    /* 🔽 Manage game loop 🔽 */

    this.tickRate = tickRate;
    const tickDuration = 1000 / this.tickRate;

    // Function that will be executed by the worker.
    function up(event) {
      if (self.computing) return;

      const data = JSON.parse(event.data);

      if (data.type === 'init') {
        self.port = event.ports[0];
        return;
      }
      
      self.computing = true;
      const { state, actions, ticks } = data;
      const newState = self.update(state, actions, ticks);
      self.port.postMessage(JSON.stringify(newState));
      self.computing = false;
    }

    // Create a worker, that will be tasked to compute the updated game state.
    const worker = new Worker(
      URL.createObjectURL(
        new Blob(['computing = false; port = null; update =', update.toString(), '; onmessage =', up.toString()], { type: 'text/javascript' })
      )
    );

    // Initializes a communication channel between this script and the worker.
    const chan = new MessageChannel();
    worker.postMessage(JSON.stringify({ type: 'init' }), [chan.port2]);

    // Update the game state when receiving the updated data from the worker.
    chan.port1.onmessage = event => this.state = JSON.parse(event.data);

    // Asks the worker to compute the updated game state.
    const requestUpdates = ticks => {
      if (ticks <= 0) return;
      this.lastTick += ticks * tickDuration;
      worker.postMessage(JSON.stringify({ state: this.state, actions: this.currentActions, ticks }));
    };

    // Game loop (inspired by https://developer.mozilla.org/en-US/docs/Games/Anatomy).
    // On each frame:
    // - request an updated game state to the worker,
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
      this.render();
      this.lastRender = frameTime;
    }

    this.gameLoop = gameLoop.bind(this);

    /* 🔼 End of game loop management 🔼 */
  }


  /** Starts the game. */
  play() {
    if (!(this.state.level instanceof Level)) throw 'No level loaded';

    this.initControls();
    this.audioCtx = new (AudioContext || webkitAudioContext)();

    this.lastTick = performance.now();
    this.lastRender = this.lastTick;

    this.start();
    this.gameLoop(performance.now());
  }


  /** Renders the game. */
  render() {
    this.canvas.clearRect(0, 0, this.width, this.height);
    const camera = this.state.level.camera;
    console.log(this.state);
    // Sort objects by their elevation (z)
    const orderedObjects = this.state.level.objects.sort((a, b) => a.z < b.z ? -1 : a.z > b.z ? 1 : 0);
    // Draw all objects from the current level
    for (const obj of orderedObjects) {
      // Compute the position of the object in the current camera view
      const posX = this.position.x - camera.x;
      const posY = this.position.y - camera.y;
      // Don't draw an object that's outside of the camera view
      if (posX < -obj.width || posY < -obj.height || posX > this.width || posY > this.height) continue;
      // Draw an object by using its sprite or its draw function
      if (obj.sprite) canvas.drawImage( this.sprite, posX, posY, this.width, this.height );
      else            obj.draw(this.canvas);
    }
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
      const buttonID = event.code || event.key;
      const actions = this.state.actions.filter(a => a.controls.includes(buttonID));
      actions.map(a => a.active = true);
    });

    // Detect keyup events and update the list of controls.
    document.addEventListener('keyup', event => {
      const buttonID = event.code || event.key;
      const actions = this.state.actions.filter(a => a.controls.includes(buttonID));
      actions.map(a => a.active = false);
    });
  }


  /** @returns {Array} The list of currently active actions. */
  get currentActions() {
    return this.state.actions.filter(a => a.active).map(a => a.name);
  }
}



/**
 * @class Game level object.
 * @property {object} sprites - The list of sprites used in the level.
 * @property {object} sounds - The list of sounds used in the level.
 * @property {AudioContext|webkitAudioContext} audioCtx - The audio context.
 */
class Level {
  constructor(game, {
    id = null,
    width = null,
    height = null,
    objects = [],
    sounds = []
  }) {
    this.id = id || game.levels.length;
    this.width = width || game.width;
    this.height = height || game.height;
    this.objects = objects;
    this.sounds = sounds.map(name => { return { id: name, sound: null } });
    this.camera = { x: 0, y: 0, z: 0, angle: 0, perspective: 0 };
  }

  async load() {
    // Load sounds.
    let responses = await Promise.all(this.sounds.map(sound => fetch(`./assets/${sound}.mp3`)));
    responses = await Promise.all(responses.map(r => r.arrayBuffer()));
    responses = await Promise.all(responses.map(r => audioCtx.decodeAudioData(r)));
    this.sounds = this.sounds.map((id, k) => { return { id: id, sound: responses[k] } });
    return;
  }

  addObject(options) {
    const spr = new GameObject(this, options);
    this.objects.push(spr);
    return spr;
  }

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
}



/**
 * @class GameObject.
 */
class GameObject {
  constructor({
    x = 0,
    y = 0,
    z = 0,
    width = 0,
    height = 0,
    sprite = null,
    draw = canvas => {},
    collision = false,
    damage = false,
  }) {
    this.position = { x, y, z };
    this.destination = { x, y, z };
    this.speed = 0;

    this.width = width;
    this.height = height;
    this.sprite = sprite;
    this.draw = draw;

    this.collision = collision;
    this.damage = damage;
  }

  /**
   * Moves a sprite on the canvas.
   * @param {number} x 
   * @param {number} y 
   * @param {number} z 
   * @param {number} angle 
   */
  moveTo(x, y, z) {

  }
}



/** TYPE DEFINITIONS */

/**
 * Game action, with a name and a list of associated controls.
 * @typedef {Object} Action
 * @property {string} name - Name of the action (example: 'jump');
 * @property {string[]} controls - List of controls / button codes associated with that action (example: ['A', 'Space']);
 */