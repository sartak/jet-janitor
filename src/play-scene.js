import Phaser from 'phaser';
import SuperScene from './scaffolding/SuperScene';
import prop from './props';
import analytics from './scaffolding/lib/analytics';

// DEEPER AND DEEPER

const GUNS = 1;

const Angle2Theta = (angle) => angle / 180 * Math.PI;
const Theta2Angle = (theta) => theta / Math.PI * 180;

const whiteColor = {
  r: 255,
  g: 255,
  b: 255,
};
const redColor = {
  r: 255,
  g: 0,
  b: 0,
};

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

  levelIds() {
    return ['tutorialStory', 'tutorialThrust', 'tutorialSteer', 'tutorialContract', 'tutorialAfterburner', 'walls', 'obstacles', 'ambush', 'tunnel', 'finale'];
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
    this.level = this.createLevel(config.levelIndex || 0, config.depth || 0, config.shallowerPlanes || [], config.shallowerWrecks || []);
    this.hud = this.createHud();

    this.setupPhysics();

    this.changePlanes();
  }

  musicName() {
    return this.level && this.level.music;
  }

  createLevel(index, depth, shallowerPlanes, shallowerWrecks) {
    let id = this.levelIds()[index];
    if (index === 0 && depth) {
      id += '2';
    }

    const level = super.createLevel(id);

    const planeGroup = level.groups.plane;
    const wreckGroup = level.groups.wreck;
    level.levelIndex = index;
    level.depth = depth;
    level.bullets = this.physics.add.group();
    level.planes = [...planeGroup.objects];
    level.planeIndex = 0;
    level.currentPlane = level.planes[level.planeIndex];
    level.turrets = [...level.groups.turret.objects];
    level.loopedSounds = [];
    level.wrecks = [];
    level.shallowerPlanes = shallowerPlanes;
    level.shallowerWrecks = shallowerWrecks;

    (shallowerPlanes[index] || []).forEach(({
      x, y, angle, textureKey, damage, perfect,
    }) => {
      const plane = planeGroup.group.create(x, y, textureKey);
      plane.angle = angle;
      plane.damage = damage;
      plane.winning = plane.inert = true;
      plane.perfect = perfect;
      this.addWinLabel(plane);
      level.planes.push(plane);
      plane.anims.play(`${plane.texture.key}Alt`);
    });

    (shallowerWrecks[index] || []).forEach(({
      x, y, angle, textureKey, winning,
    }) => {
      const wreck = wreckGroup.group.create(x, y, textureKey);
      wreck.angle = angle;
      wreck.winning = winning;
      level.wrecks.push(wreck);
    });

    const goal = level.mapLookups.$[0];
    const [, goalY] = this.positionToScreenCoordinate(goal.x, goal.y);
    level.goalDepth = goalY;

    const cooldowns = [];
    for (let i = 0; i < GUNS; i += 1) {
      cooldowns.push(-100000);
    }

    level.planes.forEach((plane) => {
      this.createBooster(plane);
      plane.afterburnerCooldown = -100000;
      plane.currentGun = 0;
      plane.thrust = 0;
      plane.roll = 0;
      plane.damage = plane.damage || 0;
      plane.planeCollideDebounce = {};
      plane.gunCooldowns = [...cooldowns];
      plane.theta = Angle2Theta(plane.angle + 180);
      plane.setDepth(10);
    });

    level.turrets.forEach((turret) => {
      // ??
      turret.afterburnerCooldown = -100000;

      turret.currentGun = 0;
      turret.gunCooldowns = cooldowns.map((c) => this.randBetween('cooldown', 1000, 2000));

      const tile = turret.tiles[0];
      if (tile.rotateRight) {
        turret.angle -= 90;
      }
      if (tile.rotateLeft) {
        turret.angle += 90;
      }
      turret.setDepth(8);
    });

    level.wrecks.forEach((wreck) => {
      this.setupWreck(wreck, true);
      wreck.setDepth(7);
    });

    level.groups.goal.objects.forEach(({tiles}) => {
      const [t] = tiles;
      const amount = 0.5 + parseInt(t.glyph, 10) / 20;
      tiles.forEach((tile) => {
        tile.image.alpha = amount;
        tile.image.setDepth(100);
      });
    });

    const {tileWidth, tileHeight} = this;

    level.groups.pregoal.objects.forEach(({tiles}) => {
      tiles.forEach((tile) => {
        const [x, y] = this.positionToScreenCoordinate(tile.x, tile.y);
        this.particleSystem(
          'effects.pregoal',
          {
            speedY: {min: -30, max: -15},
            x: {min: x, max: x + tileWidth},
            y: y + tileHeight,
            accelerationY: 10,
            tint: [0x4397F7],
            onAdd: (particles, emitter) => {
              particles.setDepth(50);
            },
          },
        );
      });
    });
    return level;
  }

  setupWreck(wreck, shallower) {
    wreck.planeCollideDebounce = {};
  }

  calculateScore() {
    const {level, time} = this;
    const {goalDepth} = level;
    const {now} = time;

    const planeHealth = prop('plane.health');
    const healthMultiplier = prop('plane.healthMultiplier');
    let score = 0;
    level.planes.forEach((plane) => {
      plane.score = Math.max(0, healthMultiplier * (planeHealth - plane.damage));

      // add score for goal depth
      if (plane.winning) {
        const depth = Math.max(0, plane.y - goalDepth) ** prop('goal.depthExponent');
        plane.score += prop('goal.depthMultiplier') * depth;

        if (plane.perfect) {
          plane.score *= 3;
        }
      }

      plane.score = Math.trunc(plane.score);

      score += plane.score;
    });

    score = Math.max(0, score);

    const newScore = (level.shownScore || score) * 0.9 + score * 0.1;
    const oldScore = level.shownScore;

    if (Math.trunc(newScore) !== Math.trunc(oldScore)) {
      level.scoreChangeAt = now;
    }

    let change = null;
    if (now - level.scoreChangeAt > 500) {
      change = null;
    } else if (newScore < oldScore) {
      change = false;
      level.prevChange = false;
    } else if (newScore > oldScore) {
      change = true;
      level.prevChange = true;
    } else {
      change = level.prevChange;
    }

    level.shownScore = newScore;
    return [`contract: $${newScore.toFixed(0)}`, change, Math.trunc(score)];
  }

  updateScore() {
    const {hud, level, tileWidth} = this;
    const {scoreSteady, scoreUp, scoreDown} = hud;

    const [text, change] = this.calculateScore();
    scoreSteady.text = scoreUp.text = scoreDown.text = text;

    scoreSteady.alpha = scoreUp.alpha = scoreDown.alpha = 0;

    if (this.level.hideContract) {
      return;
    }

    if (change === true) {
      scoreUp.alpha = 1;

      const {now} = this.time;
      if (!level.nextClinkTime || now > level.nextClinkTime) {
        level.nextClinkTime = now + this.randBetween('clink', 250, 500);
        this.playSound('clink');
      }
    } else if (change === false) {
      scoreDown.alpha = 1;
    } else {
      scoreSteady.alpha = 1;
    }

    level.planes.forEach(({
      winningLabel, x, y, score,
    }) => {
      if (winningLabel) {
        winningLabel.text = `$${score}`;
        winningLabel.x = x - winningLabel.width / 2;
        winningLabel.y = y;
      }
    });
  }

  tutorial(text, options = {}, useForcedX) {
    this.speak(useForcedX || this.level.currentPlane.x, this.level.currentPlane.y - this.tileHeight * 2, text, {
      ...options,
    });
  }

  createHud() {
    const hud = {};

    const [scoreText] = this.calculateScore();

    const scoreX = 12;
    const scoreY = 12;

    const scoreSteady = hud.scoreSteady = this.text(scoreX, scoreY, scoreText, {color: 'rgb(255, 255, 255)'});
    scoreSteady.setScrollFactor(0);
    scoreSteady.setDepth(1000);

    const scoreUp = hud.scoreUp = this.text(scoreX, scoreY, scoreText, {color: 'rgb(0, 255, 0)'});
    scoreUp.setScrollFactor(0);
    scoreUp.setDepth(1000);

    const scoreDown = hud.scoreDown = this.text(scoreX, scoreY, scoreText, {color: 'rgb(255, 0, 0)'});
    scoreDown.setScrollFactor(0);
    scoreDown.setDepth(1000);

    return hud;
  }

  afterburn(plane = this.level.currentPlane, force = false) {
    const {level, time} = this;
    const {noAfterburner} = level;
    const {now} = time;

    if (!plane) {
      return;
    }

    if (!force) {
      if (noAfterburner) {
        return;
      }

      if (plane.winning) {
        return;
      }

      if (plane.afterburnerCooldown > now) {
        return;
      }
    }

    this.playSound('afterburner');

    plane.afterburnerCooldown = now + prop('afterburner.cooldown');
    const [x, y] = this.boosterPosition(plane, prop('booster.shockOffset'));
    this.shockwave(x + plane.booster.width / 2, y + plane.booster.height / 2);
    plane.booster.anims.play('afterburnerBoosterFire', true);
    plane.booster.isAfterburner = true;
  }

  playerShoot() {
    if (this.level.noShooting) {
      return;
    }

    this.shoot(this.level.currentPlane, null, Math.PI / 8, false);
  }

  blastOff() {
    const {level} = this;
    const {currentPlane} = level;

    this.level.blastoff = true;
    this.afterburn(currentPlane, true);
    this._cameraFollow = null;
  }

  createBullet(shooter, type, theta) {
    const {level} = this;
    const {x, y} = shooter;

    const bullet = level.bullets.create(x, y, `bullet${type}`);
    bullet.shooter = shooter;
    const speed = prop(`gun.${type}.speed`);

    bullet.angle = Theta2Angle(theta) + 90;
    const vx = speed * Math.cos(theta);
    const vy = speed * Math.sin(theta);

    bullet.setVelocity(vx, vy);

    bullet.anims.play('bullet0');

    this.timer(() => {
      bullet.destroy();
    }, 10000);

    return bullet;
  }

  shoot(object, theta, variance, isTurret) {
    const {level, time} = this;
    const {now} = time;

    if (!object) {
      return;
    }

    if (level.changingPlanes) {
      return;
    }

    if (object.winning) {
      return;
    }

    const {currentGun, gunCooldowns} = object;

    if (gunCooldowns[currentGun] > now) {
      return;
    }

    const t = theta === null ? object.theta + Math.PI / 2 : theta;
    let cooldown = prop(`gun.${currentGun}.cooldown`);
    if (isTurret) {
      object.setTint(0xFFFFFF);
      cooldown *= this.randBetween('turret.cooldown', 1, 3);
      this.tweenSustain(500, 100, 500, (factor) => {
        object.setScale(1 - (factor / 5), 1 + (factor / 5));
      }, () => {
        this.createBullet(object, object.currentGun, t + this.randBetween('bulletVariance', -variance / 2, variance / 2));
      }, () => {}, () => {}, 0, 'Cubic.easeIn', 'Cubic.easeOut');
    } else {
      const recoil = prop(`gun.${currentGun}.recoil`);
      object.setVelocityX(object.body.velocity.x + recoil * -Math.cos(t));
      object.setVelocityY(object.body.velocity.y + recoil * -Math.sin(t));
      this.playSound('shoot', 3);

      [-1, 0, 1].forEach((dTheta) => {
        this.createBullet(object, object.currentGun, t + dTheta * variance);
      });
    }

    gunCooldowns[currentGun] = now + cooldown;
  }

  selectedPlane() {
    const {level} = this;
    const {planeIndex, availablePlanes} = level;

    this.playSound('thrust');
    level.selectingPlane = null;
    level.changingPlanes = false;
    level.currentPlane = availablePlanes[planeIndex];

    level.currentPlane.anims.play(`${level.currentPlane.texture.key}Current`);

    this.cameraFollow(level.currentPlane);
  }

  cameraFollow(object) {
    const {camera} = this;

    let setPosition = false;
    if (!this._cameraFollow) {
      setPosition = true;
    }

    this._cameraFollow = object;

    if (setPosition) {
      const pos = this.cameraPosition();
      if (!pos) {
        return;
      }

      [camera.scrollX, camera.scrollY] = pos;
    }
  }

  cameraPosition() {
    const {camera, _cameraFollow} = this;

    if (!_cameraFollow) {
      return null;
    }

    const originX = camera.width / 2;
    const originY = camera.height / 2;

    const fx = _cameraFollow.x;
    const fy = _cameraFollow.y;

    let dx = fx - originX;
    let dy = fy - originY;

    if (_cameraFollow.theta) {
      dx += originX / 7 * -Math.sin(_cameraFollow.theta);
      dy += originY / 7 * Math.cos(_cameraFollow.theta);
    }

    return [dx, dy];
  }

  renderUpdate(time, dt) {
    const {camera} = this;
    const pos = this.cameraPosition();
    if (pos === null) {
      return;
    }

    const [x, y] = pos;
    const lerp = prop('scene.camera.lerp');
    camera.scrollX = camera.scrollX * (1 - lerp) + x * lerp;
    camera.scrollY = camera.scrollY * (1 - lerp) + y * lerp;
  }

  createBooster(plane) {
    const booster = plane.booster = this.physics.add.sprite(plane.x, plane.y, 'booster');
    booster.alpha = 0;
    return booster;
  }

  setupPhysics() {
    const {level, physics} = this;
    const {groups, bullets} = level;
    const {
      wall, goal, plane, pregoal, turret, mine, wreck,
    } = groups;

    physics.add.collider(plane.group, wall.group, null, (...args) => this.overlapPlaneWall(...args));
    physics.add.collider(plane.group, plane.group, null, (...args) => this.overlapPlanePlane(...args));
    physics.add.collider(plane.group, turret.group, null, (...args) => this.overlapPlaneTurret(...args));
    physics.add.overlap(plane.group, bullets, null, (...args) => this.overlapPlaneBullet(...args));
    physics.add.overlap(plane.group, goal.group, null, (...args) => this.overlapPlaneGoal(...args));
    physics.add.overlap(plane.group, pregoal.group, null, (...args) => this.overlapPlanePregoal(...args));
    physics.add.overlap(turret.group, bullets, null, (...args) => this.overlapTurretBullet(...args));
    physics.add.overlap(bullets, goal.group, null, (...args) => this.overlapBulletGoal(...args));

    physics.add.overlap(plane.group, mine.group, null, (...args) => this.overlapPlaneMine(...args));
    physics.add.overlap(mine.group, bullets, null, (...args) => this.overlapMineBullet(...args));

    physics.add.collider(wreck.group, wreck.group);
    physics.add.collider(wreck.group, wall.group);
    physics.add.collider(plane.group, wreck.group, null, (...args) => this.overlapPlaneWreck(...args));
    physics.add.collider(mine.group, wreck.group, null, (...args) => this.overlapMineWreck(...args));
    physics.add.collider(wreck.group, turret.group);
    physics.add.overlap(wreck.group, goal.group, null, (...args) => this.overlapWreckGoal(...args));
  }

  overlapPlaneMine(plane, mine) {
    if (!this.damagePlane(plane, prop('plane.health'))) {
      this.playSound('explode');
    }
    this.explode(mine.x, mine.y);
    mine.destroy();
  }

  explode(x, y) {
    this.shockwave(x, y);
    this.particleSystem(
      'effects.explode',
      {
        x,
        y,
        scaleX: {min: 0.01, max: 0.5},
        scaleY: {min: 0.01, max: 0.5},
        blendMode: 'SCREEN',
        alpha: {start: 1, end: 0},
        speed: {min: 50, max: 200},
        accelerationY: {min: 100, max: 500},
        tint: [0xB13333, 0xD97217, 0xD7CB18],
        quantity: 10,
        lifespan: 1000,
        onAdd: (particles, emitter) => {
          this.timer(() => {
            emitter.stop();
          }, 100);
        },
      },
    );
  }

  overlapMineWreck(mine, wreck) {
    this.playSound('explode');
    this.explode(mine.x, mine.y);
    mine.destroy();
    this.explode(wreck.x, wreck.y);
    wreck.destroy();
  }

  overlapMineBullet(mine, bullet) {
    this.explode(mine.x, mine.y);
    mine.destroy();
    bullet.destroy();
    this.playSound('explode');
  }

  overlapPlaneGoal(plane, goal) {
    if (plane.winning) {
      return;
    }

    if (plane.damage === 0) {
      if (!this.level.hideContract) {
        this.speak(plane, 'PERFECT!', {color: 'rgb(255, 0, 255)', fontSize: 24});
      }
      plane.perfect = true;
    }

    plane.winning = true;

    if (plane === this.level.currentPlane) {
      this.playSound('goal', 0, 0.75);
    }

    this.addWinLabel(plane);
  }

  overlapWreckGoal(wreck, goal) {
    if (wreck.winning) {
      return;
    }

    wreck.winning = true;
  }

  addWinLabel(plane) {
    if (!this.level.hideContract) {
      const color = plane.perfect ? 'rgb(255, 0, 255)' : 'rgb(0, 255, 0)';
      plane.winningLabel = this.text(plane.x, plane.y, '$0', {color, fontSize: 14});
      plane.winningLabel.setDepth(1000);
    }
  }

  overlapBulletGoal(bullet, goal) {
    bullet.destroy();
  }

  overlapPlanePregoal(plane, pregoal) {
    if (plane.suction) {
      return;
    }

    plane.suction = true;
  }

  hideTutorialText() {
    let tutorialText;
    this.children.list.forEach((child) => {
      if (child.type === 'Text' && child.text.match(/war is over/)) {
        tutorialText = child;
      }
    });

    if (tutorialText) {
      tutorialText.alpha = 0;
      tutorialText.setDepth(0);
    }
  }

  finishedChuck() {
    this.timer(() => {
      this.skipLevel(1);
    }, 4000);
  }

  bringInChuck(debug = false) {
    const width = 800;
    const height = 600;

    this.cameraFollow(null);

    const chuck = this.add.image(width / 2, height / 2 - 50, 'title');
    chuck.alpha = 0;
    chuck.setScrollFactor(0);
    chuck.setDepth(100000);
    this.tween('effects.chuck.titleIn', chuck);

    this.timer(() => {
      this.hideTutorialText();

      const signature = this.add.image(width / 2, height / 2, 'signature');
      signature.setCrop(0, 0, 0, height);
      signature.setScrollFactor(0);
      signature.setDepth(100004);
      this.tween('effects.chuck.signatureIn', signature);
      this.tweenPercent(
        prop('effects.chuck.signatureIn.duration'),
        (factor) => {
          signature.setCrop(0, 0, width * factor, height);
        },
      );

      this.timer(() => {
        const name = this.text(950, 250, 'Jet Janitor', {
          fontSize: 64, color: '#6f7984',
        });
        name.alpha = 0;
        name.setScrollFactor(0);
        name.setDepth(100002);
        this.tween('effects.chuck.nameIn', name);

        this.timer(() => {
          this.finishedChuck();
        }, debug ? 10000 : prop('effects.chuck.nameIn.duration'));
      }, debug ? 1000 : prop('effects.chuck.signatureIn.duration'));
    }, debug ? 1000 : prop('effects.chuck.titleIn.duration'));
  }

  destroyPlane(plane) {
    const {level} = this;
    const wreckGroup = level.groups.wreck;

    const isCurrent = plane === level.currentPlane;

    level.planes = level.planes.filter((p) => p !== plane);

    if (plane.booster.sound) {
      try {
        plane.booster.sound.destroy();
      } catch (e) {
      }
      plane.booster.sound = null;
    }

    const {x, y, angle} = plane;
    const wreck = wreckGroup.group.create(x, y, 'wreck');
    wreck.angle = angle;
    level.wrecks.push(wreck);
    this.setupWreck(wreck, false);

    wreck.body.setVelocityX(plane.body.velocity.x * 0.5);
    wreck.body.setVelocityY(plane.body.velocity.y * 0.5);

    this.explode(x, y);
    plane.booster.destroy();
    plane.destroy();
    this.playSound('explode');

    if (isCurrent) {
      level.currentPlane = null;
      this.timer(() => {
        this.changePlanes();
      }, 2000);
    }
  }

  damageTween(object, duration = 300) {
    if (object.damageTween) {
      object.damageTween.stop();
    }
    object.damageTween = this.tweenPercent(
      duration,
      (factor) => {
        const tint = Phaser.Display.Color.Interpolate.ColorWithColor(whiteColor, redColor, 1, 1 - factor);
        const {color} = Phaser.Display.Color.ObjectToColor(tint);
        object.setTint(color);
      },
    );
  }

  damagePlane(plane, amount) {
    if (this.level.noDamage) {
      return false;
    }

    if (plane.winning) {
      this.playSound('hitPlane', 3);
      return false;
    }

    plane.damage += amount;
    if (plane === this.level.currentPlane) {
      this.trauma(plane.damage / prop('plane.health'));
    }

    this.damageTween(plane);

    if (plane.damage >= prop('plane.health')) {
      this.destroyPlane(plane);
      return true;
    } else {
      this.playSound('hitPlane', 3);
      return false;
    }
  }

  overlapPlaneBullet(plane, bullet) {
    if (bullet.shooter === plane) {
      return;
    }

    const damage = prop('plane.bulletDamage') * this.randBetween('damage', 1, 2);
    this.damagePlane(plane, damage);
    bullet.destroy();
  }

  overlapTurretBullet(turret, bullet) {
    if (bullet.shooter === turret) {
      return;
    }

    turret.gunCooldowns[turret.currentGun] += 5000;
    turret.setTint(0xFF0000);

    this.playSound('hitTurret');
    bullet.destroy();
  }

  overlapPlaneWall(plane, wall) {
    const {now} = this.time;

    if (plane.winning) {
      return;
    }

    const debounce = 100;
    const damage = prop('plane.collideDamage') * this.randBetween('damage', 1, 2);
    if (now > (plane.planeCollideDebounce.wall || 0)) {
      this.damagePlane(plane, damage);
      plane.planeCollideDebounce.wall = now + debounce;
    } else {
      // debounce

    }
  }

  overlapPlanePlane(plane1, plane2) {
    const {now} = this.time;

    const debounce = 200;
    const damage = prop('plane.collideDamage') * this.randBetween('damage', 1, 2);
    if (now > (plane1.planeCollideDebounce[plane2] || 0) || now > (plane2.planeCollideDebounce[plane1] || 0)) {
      this.damagePlane(plane1, damage);
      this.damagePlane(plane2, damage);
      plane1.planeCollideDebounce[plane2] = now + debounce;
      plane2.planeCollideDebounce[plane1] = now + debounce;
    } else {
      // debounce
    }

    const angle = Math.atan2(plane2.y - plane1.y, plane2.x - plane1.x);
    const amount = 100;
    if (plane2.body) {
      plane2.setVelocityX(plane2.body.velocity.x + amount * Math.cos(angle));
      plane2.setVelocityY(plane2.body.velocity.y + amount * Math.sin(angle));
    }
    if (plane1.body) {
      plane1.setVelocityX(plane1.body.velocity.x + amount * -Math.cos(angle));
      plane1.setVelocityY(plane1.body.velocity.y + amount * -Math.sin(angle));
    }
  }

  overlapPlaneWreck(plane, wreck) {
    const {now} = this.time;

    const debounce = 200;
    const damage = prop('plane.collideDamage') * this.randBetween('damage', 1, 2);
    if (now > (plane.planeCollideDebounce[wreck] || 0) || now > (wreck.planeCollideDebounce[plane] || 0)) {
      this.damagePlane(plane, damage);
      plane.planeCollideDebounce[wreck] = now + debounce;
      wreck.planeCollideDebounce[plane] = now + debounce;
    } else {
      // debounce
    }

    const angle = Math.atan2(wreck.y - plane.y, wreck.x - plane.x);
    const amount = 100;
    if (wreck.body) {
      wreck.setVelocityX(wreck.body.velocity.x + amount * Math.cos(angle));
      wreck.setVelocityY(wreck.body.velocity.y + amount * Math.sin(angle));
    }
    if (plane.body) {
      plane.setVelocityX(plane.body.velocity.x + amount * -Math.cos(angle));
      plane.setVelocityY(plane.body.velocity.y + amount * -Math.sin(angle));
    }
  }

  overlapPlaneTurret(plane, turret) {
    const {now} = this.time;

    const debounce = 200;
    const damage = prop('plane.collideDamage') * this.randBetween('damage', 1, 2);
    if (now > (plane.planeCollideDebounce[turret] || 0)) {
      this.damagePlane(plane, damage);
      plane.planeCollideDebounce[turret] = now + debounce;
    } else {
      // debounce
    }

    const angle = Math.atan2(turret.y - plane.y, turret.x - plane.x);
    const amount = 100;
    if (plane.body) {
      plane.setVelocityX(plane.body.velocity.x + amount * -Math.cos(angle));
      plane.setVelocityY(plane.body.velocity.y + amount * -Math.sin(angle));
    }
  }

  setupAnimations() {
    this.anims.create({
      key: 'bullet0',
      frames: [
        {
          key: 'bullet0',
          frame: 0,
        },
        {
          key: 'bullet0',
          frame: 1,
        },
      ],
      frameRate: 30,
    });


    this.anims.create({
      key: 'boosterFire',
      frames: [
        {
          key: 'booster',
          frame: 0,
        },
        {
          key: 'booster',
          frame: 1,
        },
      ],
      frameRate: 6,
      repeat: -1,
    });

    this.anims.create({
      key: 'afterburnerBoosterFire',
      frames: [
        {
          key: 'booster',
          frame: 2,
        },
        {
          key: 'booster',
          frame: 3,
        },
      ],
      frameRate: 3,
      repeat: -1,
    });

    ['player', 'enemyA', 'planeB', 'planeC', 'planeD', 'planeE', 'planeF'].forEach((type) => {
      this.anims.create({
        key: `${type}Alt`,
        frames: [
          {
            key: type,
            frame: 0,
          },
        ],
      });
      this.anims.create({
        key: `${type}Current`,
        frames: [
          {
            key: type,
            frame: 1,
          },
        ],
      });
    });
  }

  processInput(plane, dt) {
    const {command} = this;

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

    plane.thrust = thrust;
    plane.roll = roll;
  }

  selectInput(time, dt) {
    const {command, level} = this;

    let dIdx = 0;
    let stickInput;

    if (command.up.held) {
      this.selectedPlane();
      return;
    }

    if (command.right.held) {
      dIdx = 1;
    } else if (command.left.held) {
      dIdx = -1;
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

      if (dx < -0.2) {
        dIdx = -1;
      } else if (dx > 0.2) {
        dIdx = 1;
      }

      if (dy < -0.2) {
        this.selectedPlane();
        return;
      }
    }

    if (dIdx && level.debouncePlaneSelect) {
      return;
    } else if (!dIdx) {
      level.debouncePlaneSelect = false;
      return;
    }

    const planes = level.availablePlanes;
    planes.forEach((plane) => {
      plane.anims.play(`${plane.texture.key}Alt`);
    });

    if (planes.length > 1) {
      this.playSound('select');
    }

    level.planeIndex = (level.planeIndex + planes.length + dIdx) % planes.length;
    const plane = level.selectingPlane = planes[level.planeIndex];
    plane.anims.play(`${plane.texture.key}Current`);

    this.cameraFollow(plane);
    level.debouncePlaneSelect = true;
  }

  fixedUpdate(time, dt) {
    const {level} = this;
    const {
      complete, changingPlanes, planes, currentPlane, turrets,
      autopilot, wrecks,
    } = level;

    this.timeScale = 1;
    this.camera.zoom = 1;

    if (complete) {
    } else if (!autopilot && changingPlanes) {
      this.updateScore();
      this.selectInput(time, dt);
    } else {
      this.updateScore();
      planes.forEach((plane) => {
        if (!plane.nan && (isNaN(plane.x) || isNaN(plane.y))) {
          console.warn('plane is NaN\'d');
          plane.nan = true;
        }

        if (autopilot) {
          plane.thrust = 1;
          plane.angle = 90;
        } else if (plane === currentPlane) {
          this.processInput(plane, dt);
        }

        this.winner(plane, dt);
        this.thrusters(plane, dt);
        this.tradeoff(plane, dt);
        this.ailerons(plane, dt);

        if (plane === currentPlane) {
          this.gravity(plane, dt);
        } else {
          plane.body.setAccelerationX(0);
          plane.body.setAccelerationY(0);
        }

        this.booster(plane, dt);
        this.relativity(plane, dt);
        this.drag(plane, dt);
        this.suction(plane, dt);
        this.jelly(plane, dt);
      });

      wrecks.forEach((wreck) => {
        this.drag(wreck, dt);
      });

      turrets.forEach((turret) => {
        this.shmup(turret, currentPlane, dt);
      });
    }
  }

  shmup(turret, currentPlane, dt) {
    if (!currentPlane || currentPlane.winning) {
      return;
    }

    const dy = currentPlane.y - turret.y;
    const dx = currentPlane.x - turret.x;
    if (Math.sqrt(dx ** 2 + dy ** 2) > 400) {
      return;
    }
    const theta = Math.atan2(dy, dx);
    this.shoot(turret, theta, Math.PI / 8, true);
  }

  winner(plane, dt) {
    if (plane.winning) {
      plane.thrust = 0;
      plane.roll = 0;
    }
  }

  suction(plane, dt) {
    const depth = plane.y - this.level.goalDepth - this.tileHeight;
    if ((!plane.winning || depth < 0) && plane.suction) {
      plane.body.setAccelerationY(plane.body.acceleration.y + 100);
    }
  }

  jelly(plane, dt) {
    const {time, level} = this;
    const {now} = time;
    const {currentPlane} = level;

    if (level.selectingPlane && !level.autopilot) {
      plane.setVelocityX(0);
      plane.setVelocityY(0);
    }

    if (!plane.winning || plane.inert) {
      return;
    }

    const threshold = 0.1;
    if (!plane.done && Math.abs(plane.body.velocity.x) < threshold && Math.abs(plane.body.velocity.y) < threshold) {
      plane.done = now;
      plane.setVelocityX(0);
      plane.setVelocityY(0);
    }

    if (now - plane.done > prop('goal.wait')) {
      plane.inert = true;

      if (plane === currentPlane) {
        this.changePlanes();
      }
    }
  }

  changePlanes() {
    const {level} = this;
    if (level.changingPlanes) {
      return;
    }

    level.availablePlanes = level.planes.filter((p) => !p.winning).sort((a, b) => a.x - b.x);

    if (!level.availablePlanes.length) {
      this.completeLevel();
      return;
    }

    level.availablePlanes.forEach((plane) => {
      plane.anims.play(`${plane.texture.key}Alt`);
    });

    level.planeIndex = 0;
    level.changingPlanes = true;
    level.selectingPlane = level.availablePlanes[level.planeIndex];
    level.selectingPlane.anims.play(`${level.selectingPlane.texture.key}Current`);
    this.cameraFollow(level.selectingPlane);
  }

  goToLevel(index, increased = false) {
    const ids = this.levelIds();
    const count = ids.length;
    let levelIndex = (index + count) % count;
    let depth = this.level.depth || 0;
    if (levelIndex === 0 && increased) {
      depth += 1;
    }
    if (levelIndex === 1 && depth) {
      while (ids[levelIndex].startsWith('tutorial')) {
        levelIndex += 1;
      }
    }

    const shallowerPlanes = [...this.level.shallowerPlanes];
    shallowerPlanes[this.level.levelIndex] = [...this.level.planes.filter(({winning}) => winning).map(({
      x, y, angle, texture, damage, perfect,
    }) => ({
      x, y, angle, textureKey: texture.key, damage, perfect,
    }))];

    const shallowerWrecks = [...this.level.shallowerWrecks];
    shallowerWrecks[this.level.levelIndex] = [...this.level.wrecks.map(({
      x, y, angle, texture, winning,
    }) => ({
      x, y, angle, textureKey: texture.key, winning,
    }))];

    this.replaceWithSelf(true, {
      levelIndex,
      depth,
      shallowerPlanes,
      shallowerWrecks,
    }, {
      name: 'effects.winTransition',
    });
  }

  skipLevel(d) {
    this.goToLevel(this.level.levelIndex + d, d > 0);
  }

  completeLevel() {
    const {level} = this;

    if (level.complete) {
      return;
    }

    level.complete = true;
    this.skipLevel(1);
  }

  drag(object, dt) {
    if (!object.body) {
      return;
    }

    if (object.winning) {
      const drag = Math.min(0.98, prop('physics.goalDrag') + (object.afterburnerThrust || 0) / 10);
      object.setVelocityX(object.body.velocity.x * drag);
      object.setVelocityY(object.body.velocity.y * drag);
      return;
    }

    if (!('thrust' in object) || Math.abs(object.thrust) < 0.01) {
      object.setVelocityX(object.body.velocity.x * prop('physics.drag'));
    }

    if (object !== this.level.currentPlane) {
      object.setVelocityY(object.body.velocity.y * prop('physics.drag'));
    }
  }

  relativity(plane, dt) {
    const {level} = this;
    const {afterburnerThrust} = plane;

    const squish = prop('plane.squish');
    const factor = plane.thrust / squish;

    plane.squishFactor = factor * 0.9 + (plane.squishFactor || 0) * 0.1;
    plane.setScale(1 - plane.squishFactor, 1 + plane.squishFactor);

    if (plane === level.currentPlane && !level.blastoff) {
      this.timeScale = 1 + afterburnerThrust * prop('physics.timeThrust');
      this.camera.zoom = 1 + afterburnerThrust * prop('physics.zoomThrust');
    }
  }

  thrusters(plane, dt) {
    const desiredPercent = Math.max(0, plane.afterburnerCooldown - this.time.now) / prop('afterburner.cooldown');
    let afterburnerThrust = desiredPercent * 0.1 + (plane.afterburnerThrust || 0) * 0.9;
    if (afterburnerThrust < 0.01) {
      afterburnerThrust = 0;
    }
    plane.afterburnerThrust = afterburnerThrust;

    plane.thrust += prop('afterburner.thrustBoost') * afterburnerThrust;

    let max = (1 + prop('afterburner.thrustMax') * afterburnerThrust) * prop('plane.maxVelocity');
    if (this.level.autopilot) {
      if (this.level.blastoff) {
        max = 1000;
      } else {
        max = 200;
      }
    }
    plane.body.setMaxVelocity(max, max);
  }

  tradeoff(plane, dt) {
    if (plane.thrust > 1) {
      plane.roll *= prop('plane.boostRollThrustFactor');
    } else if (plane.thrust) {
      plane.roll *= prop('plane.rollThrustFactor');
    }
    if (plane.roll) {
      plane.thrust *= prop('plane.thrustRollFactor');
    }
  }

  ailerons(plane, dt) {
    const {angle, roll} = plane;

    plane.theta = Angle2Theta(angle + 180);
    plane.body.setAngularVelocity(prop('plane.droll') * roll);
  }

  gravity(plane, dt) {
    let ay = 0;
    let ax = 0;

    if (plane.thrust > 0) {
      if (!plane.winning) {
        ay = prop('plane.thrustGravity');
      }

      ay -= plane.thrust * prop('plane.power') * -1 * Math.cos(plane.theta);
      ax = plane.thrust * prop('plane.power') * -1 * Math.sin(plane.theta);
    } else if (!plane.winning) {
      ay = prop('plane.gravity');
    }

    if (this.level.autopilot) {
      ay = 0;
    }

    plane.body.setAccelerationX(ax);
    plane.body.setAccelerationY(ay);
  }

  boosterPosition(plane, bonus = 0) {
    const {
      x, y, width, height, theta,
    } = plane;

    const bx = x + (width + bonus) * Math.cos(theta - Math.PI / 2);
    const by = y + (height + bonus) * Math.sin(theta - Math.PI / 2);
    return [bx, by];
  }

  booster(plane, dt) {
    const {booster} = plane;

    if (plane.thrust <= 0.01) {
      booster.alpha = 0;
      booster.bonus = 0;
      booster.heldTime = 0;
      if (booster.sound) {
        try {
          booster.sound.destroy();
        } catch (e) {
        }

        booster.sound = null;
      }
    } else {
      booster.alpha = 0.8;
      booster.heldTime = (booster.heldTime || 0) + dt;

      if (!plane.afterburnerThrust || !plane.afterburnerThrust) {
        booster.anims.play('boosterFire', true);
        booster.isAfterburner = false;
      }

      if (!booster.sound && !this.level.autopilot) {
        booster.sound = this.playSound('thrust', 0, 0.4, true);
        this.level.loopedSounds.push(booster.sound);
      }
    }


    let distFactor = (Math.sin(booster.heldTime / prop('booster.bounce')) + 1) / 2;
    distFactor += Math.max(1, plane.thrust) - 1;
    distFactor *= 1 - plane.roll;

    const desiredBonus = distFactor * prop('booster.distance');
    const currentBonus = booster.bonus || 0;

    booster.bonus = desiredBonus * 0.1 + currentBonus * 0.9;

    [booster.x, booster.y] = this.boosterPosition(plane, booster.bonus);

    booster.angle = plane.angle;
  }

  textSize(options) {
    return '24px';
  }

  textColor(options) {
    return 'rgb(222, 158, 65)';
  }

  strokeColor(options) {
    return 'rgb(0, 0, 0)';
  }

  strokeWidth(options) {
    return 6;
  }

  cameraColor() {
    return 0x999999;
  }

  launchTimeSight() {
    super.launchTimeSight();
  }

  renderTimeSightFrameInto(scene, phantomDt, time, dt, isLast) {
    const objects = [];
    return objects;
  }

  positionBackground() {
    const {
      level, game, camera,
    } = this;
    const {background, width: levelWidth, height: levelHeight} = level;
    const {width: gameWidth, height: gameHeight} = game.config;
    const {width: backgroundWidth, height: backgroundHeight} = background;
    const {scrollX, scrollY} = camera;

    const xFactor = levelWidth > 2000 ? 0.1 : levelWidth > 1000 ? 0.2 : 0.4;
    const yFactor = levelHeight > 2000 ? 0.1 : levelHeight > 1000 ? 0.2 : 0.4;
    const factor = Math.min(xFactor, yFactor);
    background.setScrollFactor(0);
    background.alpha = 0.5;
    background.x = backgroundWidth / 2 - gameWidth / 2 - scrollX * factor;
    background.y = backgroundHeight / 2 - gameHeight / 2 - scrollY * factor;
  }

  positionBackground2() {
    const {
      level, game, camera,
    } = this;
    const {background2, width: levelWidth, height: levelHeight} = level;
    const {width: gameWidth, height: gameHeight} = game.config;
    const {width: backgroundWidth, height: backgroundHeight} = background2;
    const {scrollX, scrollY} = camera;

    const xFactor = levelWidth > 2000 ? 0.05 : levelWidth > 1000 ? 0.1 : 0.2;
    const yFactor = levelHeight > 2000 ? 0.05 : levelHeight > 1000 ? 0.1 : 0.2;
    const factor = Math.min(xFactor, yFactor);
    background2.setScrollFactor(0);
    background2.x = backgroundWidth / 2 - gameWidth / 2 - scrollX * factor;
    background2.y = backgroundHeight / 2 - gameHeight / 2 - scrollY * factor;
  }

  debugHandlePointerdown(event) {
    let {x, y} = event;

    x += this.camera.scrollX;
    y += this.camera.scrollY;
  }

  willTransitionTo(newScene, transition) {
    this.level.loopedSounds.forEach((sound) => {
      try {
        sound.destroy();
      } catch (e) {
      }
    });
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
