import SuperScene from './scaffolding/SuperScene';
import prop from './props';
import analytics from './scaffolding/lib/analytics';
import {NormalizeVector} from './scaffolding/lib/vector';

// DEEPER AND DEEPER

export default class PlayScene extends SuperScene {
  constructor() {
    super({
      input: {
        gamepad: true,
      },
      physics: {
        arcade: {
          fps: 60,
        },
      },
    });

    this.performanceProps = [];
    this.mapsAreRectangular = true;
  }

  initialSaveState() {
    return {
      createdAt: Date.now(),
    };
  }

  saveStateVersion() {
    return 1;
  }

  migrateSaveStateVersion1(save) {
  }

  init(config) {
    super.init(config);
  }

  preload() {
    super.preload();
  }

  create(config) {
    super.create(config);

    const level = this.createLevel('test');
    level.player = this.createPlayer();

    this.setupPhysics();
  }

  createPlayer(config) {
    const {level} = this;
    const tile = level.mapLookups['@'][0];
    const [x, y] = this.positionToScreenCoordinate(tile.x, tile.y);
    const player = this.physics.add.sprite(x, y, 'player');
    return player;
  }

  setupPhysics() {
    const {level, physics} = this;
    const {player, groups} = level;

    physics.add.collider(player, groups.wall.group);
  }

  setupAnimations() {
  }

  processInput(time, dt) {
    const {command, level} = this;
    const {player} = level;

    let dx = 0;
    let dy = 0;
    let stickInput = false;

    if (command.up.held) {
      dy = -1;
    } else if (command.down.held) {
      dy = 1;
    }

    if (command.right.held) {
      dx = 1;
    } else if (command.left.held) {
      dx = -1;
    }

    if (command.lstick.held) {
      [dx, dy] = command.lstick.held;
      stickInput = true;
    } else if (command.rstick.held) {
      [dx, dy] = command.rstick.held;
      stickInput = true;
    }

    if (stickInput) {
      if (Math.abs(dx) > 0.9) {
        dx = dx < 0 ? -1 : 1;
        dy = 0;
      } else if (Math.abs(dy) > 0.9) {
        dy = dy < 0 ? -1 : 1;
        dx = 0;
      }
    }

    if (dx || dy) {
      [dx, dy] = NormalizeVector(dx, dy);
    } else {
      dx = dy = 0;
    }

    player.setVelocityX(player.body.velocity.x + dx * dt);
    player.setVelocityY(player.body.velocity.y + dy * dt);
  }

  fixedUpdate(time, dt) {
    this.physics.world.gravity.y = prop('physics.gravity');

    this.processInput(time, dt);

    this.drag(dt);
  }

  drag(dt) {
    const {level} = this;
    const {player} = level;

    const fps = 1000 / 60;
    const rate = dt / fps;
    player.setVelocityX(player.body.velocity.x * rate * prop('physics.drag'));
    player.setVelocityY(player.body.velocity.y * rate * prop('physics.drag'));
  }

  textSize(options) {
    return '24px';
  }

  textColor(options) {
    return 'rgb(255, 0, 0)';
  }

  strokeColor(options) {
    return 'rgb(0, 0, 0)';
  }

  strokeWidth(options) {
    return 6;
  }

  cameraColor() {
    return 0x000000;
  }

  launchTimeSight() {
    super.launchTimeSight();
  }

  renderTimeSightFrameInto(scene, phantomDt, time, dt, isLast) {
    const objects = [];

    return objects;
  }

  debugHandlePointerdown(event) {
    let {x, y} = event;

    x += this.camera.scrollX;
    y += this.camera.scrollY;
  }

  _hotReloadCurrentLevel() {
    super._hotReloadCurrentLevel({
    }, {
      animation: 'crossFade',
      duration: 200,
      delayNewSceneShader: true,
      removeOldSceneShader: true,
    }).then((scene) => {
    });
  }

  _hot() {
  }
}
