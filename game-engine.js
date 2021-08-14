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
   * @param {number} options.frameRate - The number of frames that will be computed per second.
   */
  constructor(start = function(){}, update = function(){}, {
    canvas = document.querySelector('canvas'),
    html = document.querySelector('accessible-elements'),
    state = {},
    actions = {},
    levels = new Set(),
    frameRate = 60
  } = {}) {
    this.canvas = canvas;
    this.html = html;

    // State of the game, used to compute what to display on the next frame
    this.state = state;
    this.state.actions = actions;

    this.width = canvas.width;
    this.height = canvas.height;
    this.frameRate = frameRate;
    this.audioCtx = null;
    this.paused = false;
    this.mute = false;
    this.levels = levels;
    this.currentLevel = null;
    
    this.start = start.bind(this); // Function executed on game launch
    this.update = update.bind(this); // Function executed every frame
  }


  /** Starts the game. */
  play() {
    this.initControls();
    this.start();

    const pausable = function* () {
      let i = 0;
      while (true) {
        this.currentLevel?.objects.map(obj => obj.update());
        this.currentLevel?.update();
        this.update();
        yield i;
        i++;
      }
    };
    const pausableUpdate = pausable.bind(this)();
    setInterval(() => {
      if (!this.paused) pausableUpdate.next();
    }, 1000 / this.frameRate);
  }


  /**
   * Adds a level to the game.
   * @param {...any} args 
   */
  addLevel(...args) {
    const lev = new Level(this, ...args);
    this.levels.add(lev);
  }


  /**
   * Loads a level, its sprites and its sounds.
   * @param {string} id - Identifier of the level.
   */
  async loadLevel(id) {
    this.currentLevel = this.levels.find(level => level.id === id);
    if (this.audioCtx === null) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // Load sounds.
    let responses = await Promise.all(this.currentLevel.sounds.map(sound => fetch(`./assets/${sound}.mp3`)));
    responses = await Promise.all(responses.map(r => r.arrayBuffer()));
    responses = await Promise.all(responses.map(r => audioCtx.decodeAudioData(r)));
    this.currentLevel.sounds = this.currentLevel.sounds.map((id, k) => { return { id: id, sound: responses[k] } });
  }


  /**
   * Plays a sound.
   * @param {string} id - Identifier of the sound.
   */
  playSound(id) {
    if (this.mute) return;

    const sound = this.audioCtx.createBufferSource();
    const k = this.currentLevel.sounds.findIndex(s => s.id == id);
    if (k == -1) throw `Sound ${id} doesn't exist`;
    sound.buffer = this.currentLevel.sounds[k].sound;
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
export class Level {
  constructor(game, start = function(){}, update = function(){}, {
    width = null,
    height = null,
    objects = new Set(),
    sounds = []
  }) {
    this.game = game;
    this.width = width || this.game.width;
    this.height = height || this.game.height;
    this.objects = objects;
    this.sounds = sounds.map(name => { return { id: name, sound: null } });
    this.cameraCoordinates = { x: 0, y: 0, z: 0, angle: 0 };

    this.start = start.bind(this);
    this.update = update.bind(this);
  }

  addObject(...args) {
    const spr = new GameObject(this, ...args);
    this.objects.add(spr);
  }

  /**
   * Move the camera by moving all objects on the canvas.
   * @param {number} x - Horizontal coordinate of the top left corner of the camera view.
   * @param {number} y - Vertical coordinate of the top left corner of the camera view.
   * @param {number} z - Depth coordinate of the top left corner of the camera view.
   * @param {number} angle - Angle of rotation (in degrees) of the camera around the z axis.
   */
  set camera(x, y, z = 0, angle = 0) {
    const oldPosition = Object.assign({}, this.cameraCoordinates);
    this.cameraCoordinates = { x, y, z, angle };
    const moveBy = { x: oldPosition.x - this.cameraCoordinates.x, y: oldPosition.y - this.cameraCoordinates.y, z: oldPosition.z - this.cameraCoordinates.z, angle: oldPosition.angle - this.cameraCoordinates.angle };
    for (const obj of this.objects) {
      // Move obj by moveBy, maybe with an added variable for perspective?
      obj.moveTo(
        obj.position.x + moveBy.x,
        obj.position.y + moveBy.y,
        obj.position.z + moveBy.z
      );
    }
  }

  get camera() { return this.cameraCoordinates; }
}



/**
 * @class GameObject.
 */
export class GameObject {
  constructor(level, start = function(){}, update = function(){}, {
    x = 0,
    y = 0,
    z = 0,
    width = 0,
    height = 0,
    sprite = null,
    collision = false,
    damage = false,
  }) {
    this.level = level;
    this.game = this.level.game;
    this.position = { x, y, z };
    this.width = width;
    this.height = height;
    this.sprite = sprite;
    this.collision = collision;
    this.damage = damage;

    this.start = start.bind(this);
    this.update = update.bind(this);
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