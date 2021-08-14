/**
 * @class Game object.
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
  constructor(start, update, {
    canvas = document.querySelector('canvas'),
    html = document.querySelector('accessible-elements'),
    state = {},
    actions = {},
    levels = [],
    frameRate = 60
  } = {}) {
    this.canvas = canvas;
    this.html = html;

    // State of the game, used to compute what to display on the next frame
    this.state = state;
    this.state.actions = actions;

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
  constructor({
    sprites = {},
    sounds = []
  }) {
    this.sprites = sprites;
    this.sounds = sounds.map(name => { return { id: name, sound: null } });
  }
}



/** TYPE DEFINITIONS */

/**
 * Game action, with a name and a list of associated controls.
 * @typedef {Object} Action
 * @property {string} name - Name of the action (example: 'jump');
 * @property {string[]} controls - List of controls / button codes associated with that action (example: ['A', 'Space']);
 */