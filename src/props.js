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

export const shaderCoordFragments = null;
export const shaderColorFragments = null;
export const shaderPipelines = {
};

export const propSpecs = {
  ...builtinPropSpecs(commands, shaderCoordFragments, shaderColorFragments),

  'physics.drag': [0.9, 0, 1],

  'player.x': [0, null, 'level.player.x'],
  'player.y': [0, null, 'level.player.y'],
  'player.vx': [0, null, 'level.player.body.velocity.x'],
  'player.vy': [0, null, 'level.player.body.velocity.y'],
  'player.thrust': [0.1, null, 'level.player.thrust'],
  'player.roll': [0.1, null, 'level.player.roll'],
  'player.rollThrustFactor': [0.8, 0, 1],
  'player.thrustRollFactor': [1.0, 0, 1],
  'player.sin': [0.1, null, 'level.player.sin'],
  'player.cos': [0.1, null, 'level.player.cos'],
  'player.angle': [0.1, null, 'level.player.angle'],
  'player.theta': [0.1, null, 'level.player.theta'],
  'player.droll': [300, 0, 10000],
  'player.gravity': [300, 0, 10000],
  'player.thrustGravity': [100, 0, 10000],
  'player.power': [500, 0, 10000],
  'player.accelerationX': [0.1, null, 'level.player.body.acceleration.x'],
  'player.accelerationY': [0.1, null, 'level.player.body.acceleration.y'],
  'player.maxVelocity': [1000, 0, 10000],

  'gun.current': [0, null, 'level.currentGun'],
  'gun.currentCooldown': [0, null, 'level.gunCooldown'],
  'gun.cooldown': [2000, 0, 10000],
  'gun.next': [(scene) => scene.nextGun()],
  'gun.prev': [(scene) => scene.prevGun()],
};

export const tileDefinitions = {
  '.': null, // background
  '@': null, // player
  '#': {
    image: 'wall',
    group: 'wall',
    isStatic: true,
    combine: true,
  },
};

preprocessPropSpecs(propSpecs, particleImages);

export const manageableProps = new ManageableProps(propSpecs);
export const propsWithPrefix = makePropsWithPrefix(propSpecs, manageableProps);
export default PropLoader(propSpecs, manageableProps);
