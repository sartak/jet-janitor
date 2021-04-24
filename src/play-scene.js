import SuperScene from './scaffolding/SuperScene';
import prop from './props';
import analytics from './scaffolding/lib/analytics';
import {NormalizeVector} from './scaffolding/lib/vector';

// DEEPER AND DEEPER

const GUNS = 3;

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
    level.currentGun = 0;
    level.player = this.createPlayer();

    this.setupPhysics();

    this.cameraFollow(level.player);
  }

  setGun(idx) {
    const {level} = this;
    const {now} = this.time;

    if (level.gunCooldown && level.gunCooldown > now) {
      return;
    }

    level.gunCooldown = now + prop('gun.cooldown');
    level.currentGun = idx;
  }

  nextGun() {
    const {level} = this;
    this.setGun((level.currentGun + 1) % GUNS);
  }

  prevGun() {
    const {level} = this;
    this.setGun(((level.currentGun + GUNS) - 1) % GUNS);
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

    let thrust = 0;
    let roll = 0;
    let stickInput = false;

    if (command.up.held) {
      thrust = 1;
    }

    if (command.right.held) {
      roll = 1;
    } else if (command.left.held) {
      roll = -1;
    }

    let dx = 0;
    let dy = 0;
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

      if (dy < 0) {
        thrust = 1;
      }

      roll = dx;
    }

    if (player.thrust) {
      roll *= prop('player.rollThrustFactor');
    }

    if (player.roll) {
      thrust *= prop('player.thrustRollFactor');
    }

    player.thrust = thrust;

    player.roll = roll;
  }

  fixedUpdate(time, dt) {
    const {level, physics} = this;
    const {player} = level;

    const max = prop('player.maxVelocity');
    player.body.setMaxVelocity(max, max);

    this.processInput(time, dt);

    this.ailerons(dt);
    this.gravity(dt);
    //    this.drag(dt);
  }

  ailerons(dt) {
    const {level} = this;
    const {player} = level;
    const {angle, roll} = player;

    const theta = player.theta = (angle + 180) / 180 * Math.PI;
    player.sin = Math.sin(theta);
    player.cos = Math.cos(theta);

    player.body.setAngularVelocity(roll * prop('player.droll'));
  }

  gravity(dt) {
    const {level} = this;
    const {player} = level;

    let ay = 0;
    let ax = 0;

    if (player.thrust > 0) {
      ay = prop('player.thrustGravity');
      ay -= player.thrust * prop('player.power') * -1 * player.cos;
      ax = player.thrust * prop('player.power') * -1 * player.sin;
    } else {
      ay = prop('player.gravity');
    }

    player.body.setAccelerationX(ax);
    player.body.setAccelerationY(ay);
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
