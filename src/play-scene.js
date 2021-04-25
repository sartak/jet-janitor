import SuperScene from './scaffolding/SuperScene';
import prop from './props';
import analytics from './scaffolding/lib/analytics';

// DEEPER AND DEEPER

const GUNS = 3;

const Angle2Theta = (angle) => angle / 180 * Math.PI;
const Theta2Angle = (theta) => theta / Math.PI * 180;

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
    return ['tutorialStory', 'tutorialThrust', 'tutorialSteer', 'tutorialContract', 'test', 'finale'];
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

    this.level = this.createLevel(config.levelIndex || 0);
    this.hud = this.createHud();

    this.setupPhysics();

    this.changePlanes();
  }

  createLevel(index) {
    const id = this.levelIds()[index];
    const level = super.createLevel(id);

    level.levelIndex = index;
    level.bullets = this.physics.add.group();
    level.planes = [...level.groups.plane.objects];
    level.planeIndex = 0;
    level.currentPlane = level.planes[level.planeIndex];
    level.turrets = [...level.groups.turret.objects];

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
      plane.damage = 0;
      plane.planeCollideDebounce = {};
      plane.gunCooldowns = [...cooldowns];
      plane.theta = Angle2Theta(plane.angle + 180);
    });

    level.turrets.forEach((turret) => {
      turret.afterburnerCooldown = -100000;
      turret.currentGun = 0;
      turret.gunCooldowns = cooldowns.map((c) => this.randBetween('cooldown', 1000, 2000));
    });

    return level;
  }

  calculateScore() {
    const {level, time} = this;
    const {goalDepth} = level;
    const {now} = time;

    let score = 0;
    level.planes.forEach((plane) => {
      plane.score = Math.max(0, 1000 - plane.damage);

      // add score for goal depth
      if (plane.winning) {
        const depth = Math.max(0, plane.y - goalDepth) ** prop('goal.depthExponent');
        plane.score += prop('goal.depthMultiplier') * depth;

        if (plane.flawless) {
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

    const scoreUp = hud.scoreUp = this.text(scoreX, scoreY, scoreText, {color: 'rgb(0, 255, 0)'});
    scoreUp.setScrollFactor(0);

    const scoreDown = hud.scoreDown = this.text(scoreX, scoreY, scoreText, {color: 'rgb(255, 0, 0)'});
    scoreDown.setScrollFactor(0);

    return hud;
  }

  setGun(idx) {
    const {level, time} = this;
    const {currentPlane} = level;
    const {now} = time;

    if (this.level.noAfterburner) {
      return;
    }

    if (!currentPlane) {
      return;
    }

    if (currentPlane.winning) {
      return;
    }

    if (currentPlane.afterburnerCooldown > now) {
      return;
    }

    currentPlane.afterburnerCooldown = now + prop('afterburner.cooldown');
    currentPlane.currentGun = idx;

    const [x, y] = this.boosterPosition(currentPlane, prop('booster.shockOffset'));
    this.shockwave(x + currentPlane.booster.width / 2, y + currentPlane.booster.height / 2);
  }

  playerShoot() {
    if (this.level.noShooting) {
      return;
    }

    this.shoot();
  }

  nextGun() {
    const {level} = this;
    const {currentPlane} = level;
    if (!currentPlane) {
      return;
    }
    this.setGun((currentPlane.currentGun + 1) % GUNS);
  }

  prevGun() {
    const {level} = this;
    const {currentPlane} = level;
    if (!currentPlane) {
      return;
    }
    this.setGun(((currentPlane.currentGun + GUNS) - 1) % GUNS);
  }

  blastOff() {
    const {level} = this;
    const {currentPlane} = level;

    this.level.blastoff = true;
    this.setGun(currentPlane.currentGun);
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

    this.timer(() => {
      bullet.destroy();
    }, 10000);

    return bullet;
  }

  shoot(object = this.level.currentPlane, theta = null, variance = 0, isTurret = false) {
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

    let cooldown = prop(`gun.${currentGun}.cooldown`);
    if (isTurret) {
      object.alpha = 1;
      cooldown *= this.randBetween('turret.cooldown', 1, 3);
    }
    gunCooldowns[currentGun] = now + cooldown;

    if (theta === null) {
      theta = object.theta + Math.PI / 2;
    }

    this.createBullet(object, object.currentGun, theta + this.randBetween('bulletVariance', -variance / 2, variance / 2));
  }

  selectedPlane() {
    const {level} = this;
    const {planeIndex, availablePlanes} = level;

    level.selectingPlane = null;
    level.changingPlanes = false;
    level.currentPlane = availablePlanes[planeIndex];

    level.planes.forEach((plane) => {
      plane.alpha = 1;
    });

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
      wall, goal, plane, pregoal, turret, mine,
    } = groups;

    physics.add.collider(plane.group, wall.group, null, (...args) => this.overlapPlaneWall(...args));
    physics.add.collider(plane.group, plane.group, null, (...args) => this.overlapPlanePlane(...args));
    physics.add.collider(plane.group, turret.group, null, (...args) => this.overlapPlaneTurret(...args));
    physics.add.overlap(plane.group, bullets, null, (...args) => this.overlapPlaneBullet(...args));
    physics.add.overlap(plane.group, goal.group, null, (...args) => this.overlapPlaneGoal(...args));
    physics.add.overlap(plane.group, goal.group, null, (...args) => this.overlapPlaneGoal(...args));
    physics.add.overlap(plane.group, pregoal.group, null, (...args) => this.overlapPlanePregoal(...args));
    physics.add.overlap(turret.group, bullets, null, (...args) => this.overlapTurretBullet(...args));
    physics.add.overlap(bullets, goal.group, null, (...args) => this.overlapBulletGoal(...args));

    physics.add.overlap(plane.group, mine.group, null, (...args) => this.overlapPlaneMine(...args));
    physics.add.overlap(mine.group, bullets, null, (...args) => this.overlapMineBullet(...args));
  }

  overlapPlaneMine(plane, mine) {
    this.damagePlane(plane, 1000);
    mine.destroy();
  }

  overlapMineBullet(mine, bullet) {
    mine.destroy();
    bullet.destroy();
  }

  overlapPlaneGoal(plane, goal) {
    if (plane.winning) {
      return;
    }

    let color = 'rgb(0, 255, 0)';

    if (plane.damage === 0) {
      color = 'rgb(255, 0, 255)';
      if (!this.level.hideContract) {
        this.speak(plane, 'PERFECT!', {color, fontSize: 24});
      }
      plane.flawless = true;
    }

    plane.winning = true;

    if (!this.level.hideContract) {
      plane.winningLabel = this.text(plane.x, plane.y, '$0', {color, fontSize: 14});
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

  destroyPlane(plane) {
    const {level} = this;

    const isCurrent = plane === level.currentPlane;

    level.planes = level.planes.filter((p) => p !== plane);

    plane.booster.destroy();
    plane.destroy();

    if (isCurrent) {
      level.currentPlane = null;
      this.timer(() => {
        this.changePlanes();
      }, 2000);
    }
  }

  damagePlane(plane, amount, shakeFactor = 1) {
    if (this.level.noDamage) {
      return;
    }

    if (plane.winning) {
      return;
    }

    plane.damage += amount;
    if (plane === this.level.currentPlane) {
      this.trauma(amount / 50 * shakeFactor);
    }

    if (plane.damage >= 1000) {
      this.destroyPlane(plane);
    }
  }

  overlapPlaneBullet(plane, bullet) {
    if (bullet.shooter === plane) {
      return;
    }

    const damage = this.randBetween('damage', 10, 20);
    this.damagePlane(plane, damage);
    bullet.destroy();
  }

  overlapTurretBullet(turret, bullet) {
    if (bullet.shooter === turret) {
      return;
    }

    turret.gunCooldowns[turret.currentGun] += 1000;
    turret.alpha = 0.5;

    bullet.destroy();
  }

  overlapPlaneWall(plane, wall) {
    const {now} = this.time;

    if (plane.winning) {
      return;
    }

    const debounce = 100;
    const damage = this.randBetween('damage', 2, 5);
    if (now > (plane.planeCollideDebounce.wall || 0)) {
      this.damagePlane(plane, damage, 0.1);
      plane.planeCollideDebounce.wall = now + debounce;
    } else {
      // debounce

    }
  }

  overlapPlanePlane(plane1, plane2) {
    const {now} = this.time;

    const debounce = 200;
    const damage = this.randBetween('damage', 10, 20);
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
    plane2.setVelocityX(plane2.body.velocity.x + amount * Math.cos(angle));
    plane2.setVelocityY(plane2.body.velocity.y + amount * Math.sin(angle));
    plane1.setVelocityX(plane1.body.velocity.x + amount * -Math.cos(angle));
    plane1.setVelocityY(plane1.body.velocity.y + amount * -Math.sin(angle));
  }

  overlapPlaneTurret(plane, turret) {
    const {now} = this.time;

    const debounce = 200;
    const damage = this.randBetween('damage', 2, 5);
    if (now > (plane.planeCollideDebounce[turret] || 0)) {
      this.damagePlane(plane, damage, 0.1);
      plane.planeCollideDebounce[turret] = now + debounce;
    } else {
      // debounce
    }

    const angle = Math.atan2(turret.y - plane.y, turret.x - plane.x);
    const amount = 100;
    plane.setVelocityX(plane.body.velocity.x + amount * -Math.cos(angle));
    plane.setVelocityY(plane.body.velocity.y + amount * -Math.sin(angle));
  }

  setupAnimations() {
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
      plane.alpha = 0.25;
    });

    level.planeIndex = (level.planeIndex + planes.length + dIdx) % planes.length;
    const plane = level.selectingPlane = planes[level.planeIndex];
    plane.alpha = 1;

    this.cameraFollow(plane);
    level.debouncePlaneSelect = true;
  }

  fixedUpdate(time, dt) {
    const {level} = this;
    const {
      complete, changingPlanes, planes, currentPlane, turrets,
      autopilot,
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

      turrets.forEach((turret) => {
        this.shmup(turret, currentPlane, dt);
      });
    }
  }

  shmup(turret, currentPlane, dt) {
    if (!currentPlane || currentPlane.winning) {
      return;
    }

    const theta = Math.atan2(currentPlane.y - turret.y, currentPlane.x - turret.x);
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

    // this.physics.world.pause();

    level.availablePlanes = level.planes.filter((p) => !p.winning).sort((a, b) => a.x - b.x);

    if (!level.availablePlanes.length) {
      this.completeLevel();
      return;
    }

    level.availablePlanes.forEach((plane) => {
      plane.alpha = 0.25;
    });

    level.planeIndex = 0;
    level.changingPlanes = true;
    level.selectingPlane = level.availablePlanes[level.planeIndex];
    level.selectingPlane.alpha = 1;
    this.cameraFollow(level.selectingPlane);
  }

  goToLevel(index) {
    const count = this.levelIds().length;
    const levelIndex = (index + count) % count;

    this.replaceWithSelf(true, {
      levelIndex,
    });
  }

  skipLevel(d) {
    this.goToLevel(this.level.levelIndex + d);
  }

  completeLevel() {
    const {level} = this;

    if (level.complete) {
      return;
    }

    level.complete = true;
    this.skipLevel(1);
  }

  drag(plane, dt) {
    if (plane.winning) {
      const drag = Math.min(0.98, prop('physics.goalDrag') + plane.afterburnerThrust / 10);
      plane.setVelocityX(plane.body.velocity.x * drag);
      plane.setVelocityY(plane.body.velocity.y * drag);
      return;
    }

    if (Math.abs(plane.thrust) < 0.01) {
      plane.setVelocityX(plane.body.velocity.x * prop('physics.drag'));
    }

    if (plane !== this.level.currentPlane) {
      plane.setVelocityY(plane.body.velocity.y * prop('physics.drag'));
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
    const afterburnerThrust = plane.afterburnerThrust = desiredPercent * 0.1 + (plane.afterburnerThrust || 0) * 0.9;
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
    } else {
      booster.alpha = 1;
      booster.heldTime = (booster.heldTime || 0) + dt;
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
