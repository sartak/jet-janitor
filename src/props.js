import {
  builtinPropSpecs, ManageableProps, PropLoader, makePropsWithPrefix,
  preprocessPropSpecs,
} from './scaffolding/lib/props';

const particleImages = [
  '',
];

export const commands = {
  /*
  jump: {
    input: ['keyboard.Z', 'gamepad.A'],
  },
  */

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
    input: ['gamepad.R1'],
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
  'physics.gravity': [10000, 0, 100000],

  'player.x': [0, null, 'level.player.x'],
  'player.y': [0, null, 'level.player.y'],
  'player.vx': [0.1, null, 'level.player.body.velocity.x'],
  'player.vy': [0.1, null, 'level.player.body.velocity.y'],
  'player.facingLeft': [false, null, 'level.player.facingLeft'],

  'gun.current': [0, null, 'level.currentGun'],
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
