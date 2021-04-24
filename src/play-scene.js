import SuperScene from './scaffolding/SuperScene';
import prop from './props';
import analytics from './scaffolding/lib/analytics';

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
    level.gunCooldown = -100000;
    level.player = this.createPlayer();

    this.setupPhysics();

    this.cameraFollow(level.player);
  }

  setGun(idx) {
    const {level, time} = this;
    const {player} = level;
    const {now} = time;

    if (level.gunCooldown && level.gunCooldown > now) {
      return;
    }

    level.gunCooldown = now + prop('gun.cooldown');
    level.currentGun = idx;

    const [x, y] = this.boosterPosition(prop('booster.shockOffset'));
    this.shockwave(x + player.booster.width / 2, y + player.booster.height / 2);
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

    player.gunThrust = 0;
    player.squishFactor = 1;

    const booster = player.booster = this.physics.add.sprite(player.x, player.y, 'booster');
    booster.bonus = 0;

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

    player.thrust = thrust;
    player.roll = roll;
  }

  fixedUpdate(time, dt) {
    const {level, physics} = this;
    const {player} = level;

    this.processInput(time, dt);

    this.thrusters(dt);

    this.tradeoff(dt);
    this.ailerons(dt);
    this.gravity(dt);
    this.booster(dt);
    this.relativity(dt);

    //    this.drag(dt);
  }

  relativity(dt) {
    const {level} = this;
    const {player} = level;
    const {gunThrust} = player;

    const squish = prop('player.squish');
    const factor = player.thrust / squish;
    player.squishFactor = factor * 0.9 + player.squishFactor * 0.1;
    player.setScale(1 - player.squishFactor, 1 + player.squishFactor);

    this.timeScale = 1 + gunThrust * prop('physics.timeThrust');
    this.camera.zoom = 1 + gunThrust * prop('physics.zoomThrust');
  }

  thrusters(dt) {
    const {level, physics} = this;
    const {player} = level;

    const desiredPercent = Math.max(0, level.gunCooldown - this.time.now) / prop('gun.cooldown');
    const gunThrust = player.gunThrust = desiredPercent * 0.1 + player.gunThrust * 0.9;
    player.thrust += prop('gun.thrustBoost') * gunThrust;

    const max = (1 + prop('gun.thrustMax') * gunThrust) * prop('player.maxVelocity');
    player.body.setMaxVelocity(max, max);
  }

  tradeoff(dt) {
    const {level, physics} = this;
    const {player} = level;

    if (player.thrust > 1) {
      player.roll *= prop('player.boostRollThrustFactor');
    } else if (player.thrust) {
      player.roll *= prop('player.rollThrustFactor');
    }
    if (player.roll) {
      player.thrust *= prop('player.thrustRollFactor');
    }
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

  boosterPosition(bonus = 0) {
    const {level} = this;
    const {player} = level;
    const {
      x, y, width, height, theta,
    } = player;
    return [
      x + (width + bonus) * Math.sin(theta),
      y + (height + bonus) * (-Math.cos(theta)),
    ];
  }

  booster(dt) {
    const {level} = this;
    const {player} = level;
    const {booster} = player;

    if (player.thrust <= 0.01) {
      booster.alpha = 0;
      booster.bonus = 0;
    } else {
      booster.alpha = 1;
    }

    let distFactor = (Math.sin(this.command.up.heldFrames / prop('booster.bounce')) + 1) / 2;
    distFactor += Math.max(1, player.thrust) - 1;
    distFactor *= 1 - player.roll;

    const desiredBonus = distFactor * prop('booster.distance');
    const currentBonus = booster.bonus;

    booster.bonus = desiredBonus * 0.1 + currentBonus * 0.9;

    [booster.x, booster.y] = this.boosterPosition(booster.bonus);
    booster.angle = player.angle;
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
