type ActionsList = Map<string, string[]>;
interface position {
  x: number;
  y: number;
  z: number;
}
interface Camera extends position {
  perspective?: number;
  angle?: number;
}
type id = string | number;
type asset = { type: string, id: id, path: string, data?: any };

/**
 * @class Game.
 */
export class Game {
  canvasElement: HTMLCanvasElement;
  canvasCtx: CanvasRenderingContext2D;
  html: Element;

  width: number;
  height: number;

  audioCtx?: AudioContext;
  mute: boolean = false;

  paused: boolean = false;
  levels: Level[] = [];
  assets: asset[] = [];
  actions: ActionsList = new Map([
    ['up', ['ArrowUp', 'KeyW']],
    ['down', ['ArrowDown', 'KeyS']],
    ['left', ['ArrowLeft', 'KeyA']],
    ['right', ['ArrowRight', 'KeyD']]
  ]);
  controls: Map<string, boolean> = new Map([]);

  start: Function;

  // State of the game, used to compute what to display on the next frame
  state: { level?: Level, actions: Set<string> } & { [key: string]: any } = { actions: new Set() };
  rendering: boolean = false;
  lastRender: DOMHighResTimeStamp = 0;
  renderLoop: Function;
  computing: boolean = false;
  tickRate: number = 60;
  lastTick: DOMHighResTimeStamp = 0;
  gameLoop: Function;
  


  /**
   * Builds a new game.
   * @param start - The function executed on game launch.
   * @param update - The function executed on each frame.
   * @param params
   * @param params.canvas - The canvas on which all game objects will be drawn.Node
   * @param params.html - The container of all HTML elements that will be displayed over the canvas, (e.g. for accessible text or buttons).
   * @param params.tickRate - The number of times the game state will be updated per second.
   */
  constructor(start = function(){}, update = function(ticks: number){}, {
    canvas = document.querySelector('canvas'),
    html = document.querySelector('.accessible-elements'),
    tickRate = 60,
  } = {}) {
    if (canvas == null) throw 'Invalid canvas';
    this.canvasElement = canvas;

    const canvasCtx = canvas.getContext('2d');
    if (canvasCtx == null) throw 'Invalid canvas context';
    this.canvasCtx = canvasCtx;

    if (html == null) throw 'Invalid accessible elements container';
    this.html = html;

    this.width = canvas.width;
    this.height = canvas.height;

    for (const action of this.actions.keys()) {
      for (const control of this.actions.get(action) || []) {
        this.controls.set(control, false);
      }
    }
    
    // Function executed on game launch.
    this.start = start.bind(this);

    /* 🔽 Manage render loop 🔽 */

    // Start the render loop
    const renderLoop = async (frameTime: DOMHighResTimeStamp = performance.now()): Promise<void> => {
      const render = this.render.bind(this);

      let loopListenerSet = false;
      const loop = () => window.requestAnimationFrame(render);
      if (!loopListenerSet) {
        this.canvasElement.addEventListener('renderend', loop);
        loopListenerSet = true;
      }
      window.requestAnimationFrame(render);
    };

    this.renderLoop = renderLoop.bind(this);

    /* 🔽 Manage game loop 🔽 */

    this.tickRate = tickRate;
    const tickDuration = 1000 / this.tickRate;

    // Request an update to the game state.
    const requestUpdates = async (ticks: number): Promise<void> => {
      if (ticks <= 0) return;
      if (this.computing) return;
      this.computing = true;
      this.lastTick += ticks * tickDuration;
      this.state.actions = this.currentActions;
      update.bind(this)(ticks);
      this.computing = false;
    };

    // Game loop (inspired by https://developer.mozilla.org/en-US/docs/Games/Anatomy).
    // On each tick, request an update to the game state.
    const gameLoop = async (frameTime: DOMHighResTimeStamp): Promise<void> => {
      window.requestAnimationFrame(gameLoop.bind(this));
      if (this.paused) return;

      const nextTick = this.lastTick + tickDuration;
      let ticks = 0;
      if (frameTime > nextTick) {
        const elapsed = frameTime - this.lastTick;
        ticks = Math.floor(elapsed / tickDuration);
      }

      requestUpdates(ticks);
    };

    this.gameLoop = gameLoop.bind(this);

    /* 🔼 End of game loop management 🔼 */
  }


  /** Starts the game. */
  async play(): Promise<void> {
    this.audioCtx = new AudioContext();
    this.initControls();

    this.lastTick = performance.now();
    this.lastRender = this.lastTick;

    await this.start();
    if (!(this.state.level instanceof Level)) throw 'No level loaded';

    this.renderLoop();
    this.gameLoop(performance.now());
  }


  /**
   * Renders the game.
   * @param frameTime - Time at which the rendering started.
   */
  render(frameTime: DOMHighResTimeStamp): void {
    if (this.rendering) return;
    if (this.paused) return;
    //console.log('[Render] Starting...');

    this.canvasElement.dispatchEvent(new CustomEvent('renderstart', { detail: { time: performance.now() } } ));

    this.rendering = true;
    this.lastRender = frameTime;

    // Clears the previous frame
    this.canvasCtx.clearRect(0, 0, this.width, this.height);

    const camera = this.state.level?.camera || { x: 0, y: 0, z: 0, perspective: 0 };
    // Sort objects by their elevation (z)
    const orderedObjects = [...this.state.level?.objects || []].sort((a, b) => a.position.z < b.position.z ? -1 : a.position.z > b.position.z ? 1 : 0);
    // Draw all objects from the current level
    for (const obj of orderedObjects) {
      this.canvasCtx.save();

      // Don't display what's outside the level or camera view
      let border = new Path2D();
      border.rect(
        Math.max(0, -camera.x),
        Math.max(0, -camera.y),
        Math.min(obj.level.width, this.width),
        Math.min(obj.level.height, this.height)
      );
      this.canvasCtx.clip(border);

      // Move screen depending on camera view
      this.canvasCtx.translate(-camera.x, -camera.y);

      obj.draw(this.canvasCtx, { x: obj.position.x, y: obj.position.y, game: this });
      this.canvasCtx.restore();
    }

    this.rendering = false;

    this.canvasElement.dispatchEvent(new CustomEvent('renderend', { detail: { time: performance.now() } } ));
    //console.log('[Render] Done ✅');
  }

  
  /**
   * Add new user controlled actions.
   * @param actions - Object whose keys are action names, and values are an array of user controls.
   */
  addActions(actions: ActionsList): void {
    for (const action of actions.keys()) {
      const controls = actions.get(action) || [];
      if (controls.length > 0) this.actions.set(action, controls);
    }
  }


  /**
   * Add a sound asset to the level
   * @param id - Identifier of the asset.
   * @param path - Path of the asset.
   */
   addSound(id: id, path: string): void { this.assets.push({ type: 'sound', id, path }); }


   /**
    * Add an image asset to the level
    * @param id - Identifier of the asset.
    * @param path - Path of the asset.
    */
   addImage(id: id, path: string): void { this.assets.push({ type: 'image', id, path }); }


  /**
   * Adds a level to the game.
   * @param params - Parameters of the level.
   * @returns The added level.
   */
  addLevel(params: object): Level {
    const lev = new Level(this, params);
    this.levels.push(lev);
    return lev;
  }


  /**
   * Loads a level, its sprites and its sounds.
   * @param id - Identifier of the level to load.
   */
  async loadLevel(id: id): Promise<void> {
    this.paused = true;
    const newLevel = this.levels.find(level => level.id === id);
    await newLevel?.load();
    this.state.level = newLevel;
    this.paused = false;
  }


  /**
   * Plays a sound.
   * @param id - Identifier of the sound to play.
   */
  playSound(id: id): void {
    if (this.mute) return;
    if (!this.audioCtx) return;

    const sound = this.audioCtx.createBufferSource();
    const data = this.assets.find(s => s.id == id)?.data;
    if (typeof data === 'undefined') throw `Sound ${id} doesn't exist`;
    sound.buffer = data;
    sound.connect(this.audioCtx.destination);
    sound.start();
  }


  /** Pauses the game by pausing the update function. */
  pause(): void { this.paused = true; }


  /** Unpauses the game by unpausing the update function. */
  unpause(): void { this.paused = false; }


  /** Initializes detection of button presses. */
  initControls(): void {
    // Detect keydown events and update the list of controls.
    document.addEventListener('keydown', event => {
      if (event.repeat) return;
      //console.log('keydown', event);
      const id = event.code || event.key;
      if (typeof this.controls.get(id) === undefined) return;
      this.controls.set(id, true);
    });

    // Detect keyup events and update the list of controls.
    document.addEventListener('keyup', event => {
      //console.log('keyup', event);
      const id = event.code || event.key;
      if (typeof this.controls.get(id) === undefined) return;
      this.controls.set(id, false);
    });
  }


  /** @returns {Array} The list of currently active actions. */
  get currentActions(): Set<string> {
    const allActions = this.actions.keys();
    const active: Set<string> = new Set();
    for (const action of allActions) {
      for (const key of this.actions.get(action) || []) {
        if (this.controls.get(key)) active.add(action);
      }
    }
    return active;
  }
}





/**
 * @class Game level object.
 */
export class Level {
  game: Game;
  id: id;
  width: number;
  height: number;
  objects: Set<GameObject> = new Set();
  camera: Camera;
  audioCtx?: AudioContext;

  /**
   * Create a new game level.
   * @param game - The game this level will belong to.
   * @param params - Parameters of the level.
   * @param {string?} params.id - Identifier of the level.
   * @param {number?} params.width - Width of the level, in pixels.
   * @param {number?} params.height - Height of the level, in pixels.
   */
  constructor(game: Game, {
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
  async load(): Promise<void> {
    // Get the list of assets used in the new level
    const assets: Set<asset> = new Set();
    for (const obj of this.objects) {
      for (const asset of obj.assets) {
        assets.add(asset);
      }
    }

    // Load assets
    await Promise.all([...assets].map(async asset => {
      if (!!asset.data) return asset.data;
      let response = await fetch(asset.path);
      let data: AudioBuffer | ImageBitmap | undefined;
      switch (asset.type) {
        case 'sound': {
          const buffer = await response.arrayBuffer();
          data = await this.audioCtx?.decodeAudioData(buffer);
        } break;
        case 'image': {
          const blob = await response.blob();
          data = await createImageBitmap(blob);
        } break;
      }
      return asset.data = data;
    }));

    const oldLevel = this.game.state.level;
    if (oldLevel instanceof Level) {
      // Get the list of assets used in the old level
      const oldAssets: Set<asset> = new Set();
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
   * @param params - The parameters of the GameObject.
   * @returns The added object.
   */
  addObject(params: object): GameObject {
    const spr = new GameObject(this, params);
    this.objects.add(spr);
    return spr;
  }


  /*getObject(id) {
    return this.objects.find(o => o.id === id);
  }*/


  /**
   * Move the camera by moving all objects on the canvas.
   * @param x - Horizontal coordinate of the top left corner of the camera view.
   * @param y - Vertical coordinate of the top left corner of the camera view.
   * @param z - Depth coordinate of the top left corner of the camera view.
   * @param angle - Angle of rotation (in degrees) of the camera around the z axis.
   */
  moveCamera({ x, y, z, angle }: Camera = { x: 0, y: 0, z: 0, angle: 0 }): void {
    const oldPosition = Object.assign({}, this.camera);
    this.camera = { x, y, z, angle };
    const moveBy = { x: oldPosition.x - this.camera.x, y: oldPosition.y - this.camera.y, z: oldPosition.z - this.camera.z, angle: (oldPosition.angle || 0) - (this.camera.angle || 0) };
    for (const obj of this.objects) {
      // TODO: Move obj by moveBy, maybe with an added variable for perspective?
    }
  }
}





/**
 * @class GameObject.
 */
export class GameObject {
  level: Level;
  game: Game;
  id: id;
  position: position;
  maxSpeed: number; // pixels per tick;
  speed: position = { x: 0, y: 0, z: 0 }; // pixels per tick;
  angle: number = 0;
  state: object = {};
  width: number;
  height: number;
  draw: Function;
  collision: boolean;
  damage: boolean;
  controllable: boolean;
  assets: Game['assets'];

  /**
   * Create a new GameObject.
   * @param level - The level that will contain the object.
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
  constructor(level: Level, {
    id = '',
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

    this.width = width;
    this.height = height;
    this.draw = draw.bind(this);

    this.collision = collision;
    this.damage = damage;
    this.controllable = controllable;

    this.assets = this.game.assets.filter(a => assets.includes(a.id as never));
  }


  /**
   * Moves an object (single frame).
   * @param {object} options - Movement options.
   * @param {boolean} apply - Whether to actually move the object or not.
   * @returns {object} The position the object would have after moving.
   */
  move({ apply = true } = {}): position {
    const oldPosition = Object.assign({}, this.position);
    const width = this.width, height = this.height;

    let x = this.position.x + this.speed.x;
    let y = this.position.y + this.speed.y;

    // Send a player ghost to the new position and check if it collides with something
    const tempXY = new GameObject(this.level, { position: { x, y, z: 0 }, width, height, collision: true });
    const collisionsXY = tempXY.allCollisions({ exclude: [this], forceCollision: false });    
    const collidesXY = collisionsXY.length > 0;

    // If the ghost collided with something, close the distance then stop moving in the blocking direction(s)
    if (collidesXY) {
      // Close the distance between the object and the closest blocking object
      const distances = collisionsXY.map(obj => this.distanceTo(obj));
      const minDistance = { x: Math.min(...distances.map(d => d.x)), y: Math.min(...distances.map(d => d.y)) };
      x += minDistance.x;
      y += minDistance.y;

      // Check if one direction is still unblocked
      const tempX = new GameObject(this.level, { position: { x, y: oldPosition.y, z: 0 }, width, height, collision: true });
      const tempY = new GameObject(this.level, { position: { x: oldPosition.x, y, z: 0 }, width, height, collision: true });
      const collidesX = tempX.allCollisions({ exclude: [this], forceCollision: false }).length > 0;
      const collidesY = tempY.allCollisions({ exclude: [this], forceCollision: false }).length > 0;

      // Only keep the speed component in the unblocked direction(s)
      if (collidesX && !collidesY)      x -= this.speed.x;
      else if (collidesY && !collidesX) y -= this.speed.y;
      else x -= this.speed.x, y -= this.speed.y;
    }

    if (apply) this.position = Object.assign(this.position, { x, y });
    return { x, y, z: 0 };
  }


  /**
   * Move the object towards the direction given by a vector.
   * @param vector - Direction vector.
   * @param vector.x - Horizontal distance to travel.
   * @param vector.y - Vertical distance to travel.
   * @param options - Movement options.
   */
  moveByVector({ x, y }: position, options: object): position {
    const cos = x / Math.sqrt(x**2 + y**2);
    const sin = y * Math.sqrt(1 - cos**2);
    const max = this.maxSpeed;

    this.speed = {
      x: max * cos,
      y: max * sin,
      z: 0
    };
    return this.move(options);
  }


  /**
   * Determines if there is collision between two objects.
   * @param obj - The object to check collision with.
   * @return Whether there is a collision.
   */
  collidesWith(obj: GameObject): boolean {
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
   * @param options
   * @param options.exclude - List of game objects to ignore.
   * @param options.forceCollision - Whether to force the collision, even if one of the objects is not collision-able.
   * @return List of objects colliding with this object.
   */
  allCollisions({ exclude, forceCollision }: { exclude: GameObject[], forceCollision: boolean } = { exclude: [], forceCollision: false }): GameObject[] {
    const cols: GameObject[] = [];
    for (const obj of this.level.objects) {
      if (obj === this || exclude.includes(obj)) continue;
      if (!forceCollision && (!this.collision || !obj.collision)) continue;
      if (this.collidesWith(obj)) cols.push(obj);
    }
    return cols;
  }


  /**
   * Distance from this to an object.
   * @param obj - The object used to compute the distance between it and this.
   * @return The computed distance along each axis.
   */
  distanceTo(obj: GameObject): position {
    let dx = 0, dy = 0;
    // If the objects collide, distance is zero. If not, it's equal to the number of pixels
    // between the closest borders of each object along each axis.
    if (!this.collidesWith(obj)) {
      if (obj.position.x + obj.width < this.position.x)        dx = (obj.position.x + obj.width) - this.position.x;
      else if (this.position.x + this.width < obj.position.x)  dx = obj.position.x - (this.position.x + this.width);
      if (obj.position.y + obj.height < this.position.y)       dy = (obj.position.y + obj.height) - this.position.y;
      else if (this.position.y + this.height < obj.position.y) dy = obj.position.y - (this.position.y + this.height);
    }
    return { x: dx, y: dy, z: 0 };
  }
}






/** TYPE DEFINITIONS */

/**
 * Game action, with a name and a list of associated controls.
 * @typedef {Object} Action
 * @property {string} name - Name of the action (example: 'jump');
 * @property {string[]} controls - List of controls / button codes associated with that action (example: ['A', 'Space']);
 */