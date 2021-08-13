/**
 * Game action, with a name and a list of associated controls.
 * @typedef {Object} Action
 * @property {string} name - Name of the action (example: 'jump');
 * @property {string[]} controls - List of controls / button codes associated with that action (example: ['A', 'Space']);
 */

export default class Game {
  /**
   * Builds a new game.
   * @param {function} start - The function executed on game launch.
   * @param {function} update - The function executed on each frame.
   * @param {object} options
   * @param {Element} options.canvas - The canvas on which all game objects will be drawn.Node
   * @param {Element} options.html - The container of all HTML elements that will be displayed over the canvas, for example for accessible text or buttons.
   * @param {object} options.state - The initial state data of the game.
   * @param {Action} options.actions - The list of actions and their associated controls.
   * @param {number} options.frameRate - The number of frames that will be computed per second.
   */
  constructor(start, update, {
    canvas = document.querySelector('canvas'),
    html = document.querySelector('accessible-elements'),
    state = {},
    actions = {},
    frameRate = 60
  } = {}) {
    this.canvas = canvas;
    this.html = html;

    // State of the game, used to compute what to display on the next frame
    this.state = state;
    this.state.controls = {};
    this.state.actions = actions;

    this.frameRate = frameRate;
    this.paused = false;
    
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

  get currentActions() {
    return this.state.actions.filter(a => a.active).map(a => a.name);
  }
}