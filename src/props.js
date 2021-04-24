import {
  builtinPropSpecs, ManageableProps, PropLoader, makePropsWithPrefix,
  preprocessPropSpecs,
} from './scaffolding/lib/props';

const particleImages = [
  '',
];

export const commands = {
  shoot: {
    input: ['keyboard.Z', 'gamepad.A'],
    execute: 'shoot',
    cooldown: 300,
  },

  nextGun: {
    input: ['keyboard.X', 'gamepad.R1'],
    execute: 'nextGun',
  },
  prevGun: {
    input: ['keyboard.C', 'gamepad.L1'],
    execute: 'prevGun',
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
  'plane.squish': [60, 1, 100],
  'plane.wallBounce': [10000, 0, 100000],
  'plane.planeBounce': [10000, 0, 100000],
  'plane.bounceTime': [1000, 0, 10000],

  'currentPlane.x': [0, null, 'level.currentPlane.x'],
  'currentPlane.y': [0, null, 'level.currentPlane.y'],
  'currentPlane.vx': [0.1, null, 'level.currentPlane.body.velocity.x'],
  'currentPlane.vy': [0.1, null, 'level.currentPlane.body.velocity.y'],
  'currentPlane.thrust': [0.1, null, 'level.currentPlane.thrust'],
  'currentPlane.roll': [0.1, null, 'level.currentPlane.roll'],
  'currentPlane.sin': [0.1, null, 'level.currentPlane.sin'],
  'currentPlane.cos': [0.1, null, 'level.currentPlane.cos'],
  'currentPlane.angle': [0.1, null, 'level.currentPlane.angle'],
  'currentPlane.theta': [0.1, null, 'level.currentPlane.theta'],
  'currentPlane.accelerationX': [0.1, null, 'level.currentPlane.body.acceleration.x'],
  'currentPlane.accelerationY': [0.1, null, 'level.currentPlane.body.acceleration.y'],
  'currentPlane.gunThrust': [0.1, null, 'level.currentPlane.gunThrust'],

  'booster.x': [0, null, 'level.currentPlane.booster.x'],
  'booster.y': [0, null, 'level.currentPlane.booster.y'],
  'booster.angle': [0, null, 'level.currentPlane.booster.angle'],
  'booster.bounce': [15, 0, 500],
  'booster.distance': [10, 0, 1000],
  'booster.bonus': [0.1, null, 'level.currentPlane.booster.bonus'],
  'booster.shockOffset': [32, 0, 100],

  'gun.current': [0, null, 'level.currentGun'],
  'gun.currentCooldown': [0, null, 'level.gunCooldown'],
  'gun.cooldown': [2000, 0, 10000],
  'gun.thrustBoost': [3, 0, 10],
  'gun.thrustMax': [1.0, 0, 10],
  'gun.next': [(scene) => scene.nextGun()],
  'gun.prev': [(scene) => scene.prevGun()],

  'gun.0.speed': [500, 0, 10000],
  'gun.1.speed': [500, 0, 10000],
  'gun.2.speed': [500, 0, 10000],

  'goal.wait': [1000, 0, 10000],
  'goal.planeIndex': [0, null, 'level.planeIndex'],
  'goal.planeDebounce': [false, null, 'level.debouncePlaneSelect'],
  'goal.depthMultiplier': [10, 0, 100],
};

export const tileDefinitions = {
  '.': null, // background
  '#': {
    image: 'wall',
    group: 'wall',
    isStatic: true,
    combine: true,
  },
  $: {
    group: 'pregoal',
    isStatic: true,
    combine: true,
  },
  1: {
    image: 'goal',
    group: 'goal',
    isStatic: true,
    combine: true,
  },
  2: {
    image: 'goal',
    group: 'goal',
    isStatic: true,
    combine: true,
  },
  3: {
    image: 'goal',
    group: 'goal',
    isStatic: true,
    combine: true,
  },
  4: {
    image: 'goal',
    group: 'goal',
    isStatic: true,
    combine: true,
  },
  5: {
    image: 'goal',
    group: 'goal',
    isStatic: true,
    combine: true,
  },
  6: {
    image: 'goal',
    group: 'goal',
    isStatic: true,
    combine: true,
  },
  7: {
    image: 'goal',
    group: 'goal',
    isStatic: true,
    combine: true,
  },
  8: {
    image: 'goal',
    group: 'goal',
    isStatic: true,
    combine: true,
  },
  9: {
    image: 'goal',
    group: 'goal',
    isStatic: true,
    combine: true,
  },
  '@': {
    plane: true,
    image: 'player',
    group: 'plane',
  },
  A: {
    plane: true,
    image: 'enemyA',
    group: 'plane',
  },
};

preprocessPropSpecs(propSpecs, particleImages);

export const manageableProps = new ManageableProps(propSpecs);
export const propsWithPrefix = makePropsWithPrefix(propSpecs, manageableProps);
export default PropLoader(propSpecs, manageableProps);
