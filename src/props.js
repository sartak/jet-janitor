import {
  builtinPropSpecs, ManageableProps, PropLoader, makePropsWithPrefix,
  preprocessPropSpecs,
} from './scaffolding/lib/props';

const particleImages = [
  'effectImageCircle',
];

export const commands = {
  shoot: {
    input: ['keyboard.Z', 'gamepad.A'],
    execute: 'playerShoot',
  },

  afterburner: {
    input: ['keyboard.X', 'gamepad.X'],
    execute: 'afterburn',
  },

  up: {
    input: ['keyboard.UP', 'gamepad.UP'],
  },
  down: {
    input: ['keyboard.DOWN', 'gamepad.DOWN'],
  },
  left: {
    input: ['keyboard.LEFT', 'gamepad.LEFT'],
  },
  right: {
    input: ['keyboard.RIGHT', 'gamepad.RIGHT'],
  },
  lstick: {
    input: ['gamepad.LSTICK.RAW'],
    joystick: true,
  },
  rstick: {
    input: ['gamepad.RSTICK.RAW'],
    joystick: true,
  },

  next: {
    input: ['keyboard.N'],
    execute: (scene) => scene.skipLevel(1),
    debug: true,
    unignorable: true,
    unreplayable: true,
  },
  prev: {
    input: ['keyboard.P'],
    execute: (scene) => scene.skipLevel(-1),
    debug: true,
    unignorable: true,
    unreplayable: true,
  },
  restart: {
    input: ['keyboard.R'],
    execute: (scene) => scene.replaceWithSelf(),
    debug: true,
    unignorable: true,
    unreplayable: true,
  },
  quit: {
    input: ['keyboard.Q'],
    execute: 'forceQuit',
    debug: true,
    unignorable: true,
    unreplayable: true,
  },
  recordCycle: {
    input: ['gamepad.Y'],
    unreplayable: true,
    debug: true,
    unignorable: true,
    execute: (scene, game) => {
      const {_replay, _recording} = game;
      if (_replay && _replay.timeSight) {
        game.stopReplay();
      } else if (_replay) {
        setTimeout(() => {
          game.stopReplay();
          game.beginReplay({..._replay, timeSight: true});
        });
      } else if (_recording) {
        game.stopRecording();
      } else {
        game.beginRecording();
      }
    },
  },
};

export const shaderCoordFragments = [
  'shockwave',
];
export const shaderColorFragments = [
  'blur',
];
export const shaderPipelines = {
};

export const propSpecs = {
  ...builtinPropSpecs(commands, shaderCoordFragments, shaderColorFragments),


  'physics.goalDrag': [0.95, 0, 1],
  'physics.drag': [0.98, 0, 1],
  'physics.timeThrust': [5, 0, 10],
  'physics.zoomThrust': [0.15, 0, 1],

  'level.goalDepth': [0, null],

  'plane.boostRollThrustFactor': [0.3, 0, 1],
  'plane.rollThrustFactor': [0.8, 0, 1],
  'plane.thrustRollFactor': [1.0, 0, 1],
  'plane.droll': [300, 0, 10000],
  'plane.gravity': [300, 0, 10000],
  'plane.thrustGravity': [100, 0, 10000],
  'plane.power': [500, 0, 10000],
  'plane.maxVelocity': [500, 0, 10000],
  'plane.squish': [30, 1, 100],
  'plane.wallBounce': [10000, 0, 100000],
  'plane.planeBounce': [10000, 0, 100000],
  'plane.bounceTime': [100, 0, 10000],
  'plane.health': [100, 0, 10000],
  'plane.healthMultiplier': [2.0, 0, 10],
  'plane.bulletDamage': [5, 0, 1000],
  'plane.collideDamage': [2, 0, 1000],

  'currentPlane.x': [0, null, 'level.currentPlane.x'],
  'currentPlane.y': [0, null, 'level.currentPlane.y'],
  'currentPlane.vx': [0.1, null, 'level.currentPlane.body.velocity.x'],
  'currentPlane.vy': [0.1, null, 'level.currentPlane.body.velocity.y'],
  'currentPlane.thrust': [0.1, null, 'level.currentPlane.thrust'],
  'currentPlane.roll': [0.1, null, 'level.currentPlane.roll'],
  'currentPlane.angle': [0.1, null, 'level.currentPlane.angle'],
  'currentPlane.theta': [0.1, null, 'level.currentPlane.theta'],
  'currentPlane.accelerationX': [0.1, null, 'level.currentPlane.body.acceleration.x'],
  'currentPlane.accelerationY': [0.1, null, 'level.currentPlane.body.acceleration.y'],
  'currentPlane.afterburnerThrust': [0.1, null, 'level.currentPlane.afterburnerThrust'],
  'currentPlane.destroy': [(scene) => scene.destroyPlane(scene.level.currentPlane)],

  'booster.x': [0, null, 'level.currentPlane.booster.x'],
  'booster.y': [0, null, 'level.currentPlane.booster.y'],
  'booster.angle': [0, null, 'level.currentPlane.booster.angle'],
  'booster.bounce': [300, 0, 500],
  'booster.distance': [10, 0, 1000],
  'booster.bonus': [0.1, null, 'level.currentPlane.booster.bonus'],
  'booster.shockOffset': [32, 0, 100],

  'afterburner.currentCooldown': [0, null, 'level.currentPlane.afterburnerCooldown'],
  'afterburner.cooldown': [2000, 0, 10000],
  'afterburner.thrustBoost': [3, 0, 10],
  'afterburner.thrustMax': [1.0, 0, 10],

  'gun.current': [0, null, 'level.currentPlane.currentGun'],
  'gun.next': [(scene) => scene.nextGun()],
  'gun.prev': [(scene) => scene.prevGun()],

  'gun.0.speed': [500, 0, 10000],
  'gun.0.cooldown': [500, 0, 10000],
  'gun.0.recoil': [300, 0, 10000],

  'goal.wait': [1000, 0, 10000],
  'goal.planeIndex': [0, null, 'level.planeIndex'],
  'goal.planeDebounce': [false, null, 'level.debouncePlaneSelect'],
  'goal.depthExponent': [1.3, 0, 10],
  'goal.depthMultiplier': [10, 0, 100],

  'effects.hint.attract.tween': [{
    duration: 2000,
    dy: 8,
    ease: 'Quad.easeInOut',
    yoyo: true,
    loop: -1,
  }],

  'effects.winTransition.transition': [{
    animation: 'fadeInOut',
    duration: 1000,
  }],

  'effects.chuck.titleIn.tween': [{
    alpha: 1,
    dy: 50,
    ease: 'Cubic.easeOut',
    duration: 500,
  }],

  'effects.chuck.signatureIn.tween': [{
    duration: 2000,
  }],

  'effects.chuck.nameIn.tween': [{
    alpha: 1,
    dx: -500,
    ease: 'Cubic.easeOut',
    duration: 1000,
  }],

  'effects.explode.particles': [{
    image: 'effectImageCircle',
    quantity: 50,
  }],

  'effects.pregoal.particles': [{
    image: 'effectImageCircle',
    preemit: true,
    scaleX: 0.05,
    scaleY: 0.05,
    quantity: 1,
    frequency: 1,
    lifespan: 1000,
  }],
};

propSpecs['scene.camera.lerp'][0] = 0.1;
propSpecs['scene.camera.hasBounds'][0] = false;

export const tileDefinitions = {
  '.': null, // background
  // used when vault is narrower to ensure vault is fully combined
  '<': {
    image: 'vault',
    group: 'wall',
    isStatic: true,
    combine: '<',
    preferCombineVertical: true,
  },
  '>': {
    image: 'vaultR',
    group: 'wall',
    isStatic: true,
    combine: '<',
    preferCombineVertical: true,
  },
  '^': {
    image: 'vaultB',
    group: 'wall',
    isStatic: true,
    combine: '<',
    preferCombineVertical: true,
  },

  // used when vault is same size to get a smooth wall
  '[': {
    image: 'vault',
    group: 'wall',
    isStatic: true,
    combine: '#',
    preferCombineVertical: true,
  },
  ']': {
    image: 'vaultR',
    group: 'wall',
    isStatic: true,
    combine: '#',
    preferCombineVertical: true,
  },
  _: {
    image: 'vaultB',
    group: 'wall',
    isStatic: true,
    combine: '#',
    preferCombineVertical: true,
  },

  '-': {
    image: 'wall',
    group: 'wall',
    isStatic: true,
    combine: '#',
    preferCombineVertical: false,
  },
  '|': {
    image: 'wallVertical',
    group: 'wall',
    isStatic: true,
    combine: '#',
    preferCombineVertical: true,
  },
  t: {
    image: 'wallTop',
    group: 'wall',
    isStatic: true,
    combine: '#',
    preferCombineVertical: true,
  },
  b: {
    image: 'wallBottom',
    group: 'wall',
    isStatic: true,
    combine: '#',
    preferCombineVertical: true,
  },
  l: {
    image: 'wallTL',
    group: 'wall',
    isStatic: true,
    combine: '#',
  },
  r: {
    image: 'wallTR',
    group: 'wall',
    isStatic: true,
    combine: '#',
  },
  c: {
    image: 'wallBL',
    group: 'wall',
    isStatic: true,
    combine: '#',
  },
  d: {
    image: 'wallBR',
    group: 'wall',
    isStatic: true,
    combine: '#',
  },
  $: {
    group: 'pregoal',
    isStatic: true,
    combine: true,
  },
  1: {
    image: 'goalTile',
    group: 'goal',
    isStatic: true,
    combine: true,
  },
  2: {
    image: 'goalTile',
    group: 'goal',
    isStatic: true,
    combine: true,
  },
  3: {
    image: 'goalTile',
    group: 'goal',
    isStatic: true,
    combine: true,
  },
  4: {
    image: 'goalTile',
    group: 'goal',
    isStatic: true,
    combine: true,
  },
  5: {
    image: 'goalTile',
    group: 'goal',
    isStatic: true,
    combine: true,
  },
  6: {
    image: 'goalTile',
    group: 'goal',
    isStatic: true,
    combine: true,
  },
  7: {
    image: 'goalTile',
    group: 'goal',
    isStatic: true,
    combine: true,
  },
  8: {
    image: 'goalTile',
    group: 'goal',
    isStatic: true,
    combine: true,
  },
  9: {
    image: 'goalTile',
    group: 'goal',
    isStatic: true,
    combine: true,
  },
  '&': {
    image: 'wreck',
    group: 'wreck',
  },
  '@': {
    image: 'player',
    group: 'plane',
  },
  A: {
    image: 'enemyA',
    group: 'plane',
  },
  B: {
    image: 'planeB',
    group: 'plane',
  },
  C: {
    image: 'planeC',
    group: 'plane',
  },
  D: {
    image: 'planeD',
    group: 'plane',
  },
  E: {
    image: 'planeE',
    group: 'plane',
  },
  F: {
    image: 'planeF',
    group: 'plane',
  },
  T: {
    image: 'turret',
    group: 'turret',
    isStatic: true,
  },
  V: {
    image: 'turretV',
    group: 'turret',
    isStatic: true,
  },
  L: {
    image: 'turretV',
    group: 'turret',
    rotateLeft: true,
    isStatic: true,
  },
  R: {
    image: 'turretV',
    group: 'turret',
    rotateRight: true,
    isStatic: true,
  },
  M: {
    image: 'mine',
    group: 'mine',
    isStatic: true,
  },
};

preprocessPropSpecs(propSpecs, particleImages);

export const manageableProps = new ManageableProps(propSpecs);
export const propsWithPrefix = makePropsWithPrefix(propSpecs, manageableProps);
export default PropLoader(propSpecs, manageableProps);
