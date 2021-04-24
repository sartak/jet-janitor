import SuperScene from './scaffolding/SuperScene';
import prop from './props';
import analytics from './scaffolding/lib/analytics';

// DEEPER AND DEEPER

const GUNS = 3;

const Angle2Theta = (angle) => (angle + 180) / 180 * Math.PI;

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

    const level = this.level = this.createLevel('test');
    const hud = this.hud = this.createHud();

    this.setupPhysics();

    this.cameraFollow(level.currentPlane);
  }

  createLevel(id) {
    const level = super.createLevel(id);

    level.bullets = this.physics.add.group();
    level.planes = [...level.groups.plane.objects];
    level.planeIndex = 0;
    level.currentPlane = level.planes[level.planeIndex];

    const goal = level.mapLookups.$[0];
    const [, goalY] = this.positionToScreenCoordinate(goal.x, goal.y);
    level.goalDepth = goalY;

    level.planes.forEach((plane) => {
      this.createBooster(plane);
      plane.gunCooldown = -100000;
      plane.currentGun = 0;
      plane.thrust = 0;
      plane.roll = 0;
      plane.damage = 0;
      plane.planeCollideDebounce = {};
    });

    return level;
  }

  calculateScore() {
    const {level} = this;
    const {goalDepth} = level;

    let score = 0;
    level.planes.forEach((plane) => {
      let planeScore = Math.max(0, 1000 - plane.damage);

      // add score for goal depth
      if (plane.winning) {
        planeScore += prop('goal.depthMultiplier') * Math.max(0, plane.y - goalDepth);
      }

      score += planeScore;
    });

    score = Math.max(0, score);

    level.shownScore = (level.shownScore || score) * 0.9 + score * 0.1;
    let change = null;

    const shownFixed = level.shownScore.toFixed(0);
    const scoreFixed = score.toFixed(0);
    if (scoreFixed < shownFixed) {
      change = false;
    } else if (scoreFixed > shownFixed) {
      change = true;
    }

    return [`contract: $${shownFixed}`, change, scoreFixed];
  }

  updateScore() {
    const {hud} = this;
    const {scoreSteady, scoreUp, scoreDown} = hud;

    const [text, change] = this.calculateScore();
    scoreSteady.text = scoreUp.text = scoreDown.text = text;

    scoreSteady.alpha = scoreUp.alpha = scoreDown.alpha = 0;

    if (change === true) {
      scoreUp.alpha = 1;
    } else if (change === false) {
      scoreDown.alpha = 1;
    } else {
      scoreSteady.alpha = 1;
    }
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

    if (currentPlane.winning) {
      return;
    }

    if (currentPlane.gunCooldown && currentPlane.gunCooldown > now) {
      return;
    }

    currentPlane.gunCooldown = now + prop('gun.cooldown');
    currentPlane.currentGun = idx;

    const [x, y] = this.boosterPosition(currentPlane, prop('booster.shockOffset'));
    this.shockwave(x + currentPlane.booster.width / 2, y + currentPlane.booster.height / 2);
  }

  nextGun() {
    const {level} = this;
    const {currentPlane} = level;
    this.setGun((currentPlane.currentGun + 1) % GUNS);
  }

  prevGun() {
    const {level} = this;
    const {currentPlane} = level;
    this.setGun(((currentPlane.currentGun + GUNS) - 1) % GUNS);
  }

  createBullet(shooter) {
    const {level} = this;
    const type = shooter.currentGun;
    const {x, y, angle} = shooter;

    const bullet = level.bullets.create(x, y, `bullet${type}`);
    bullet.shooter = shooter;
    bullet.angle = angle;
    const theta = bullet.theta = Angle2Theta(angle);
    const speed = prop(`gun.${type}.speed`);

    const vx = /* shooter.body.velocity.x +*/ speed * -Math.sin(theta);
    const vy = /* shooter.body.velocity.y +*/ speed * Math.cos(theta);

    bullet.setVelocity(vx, vy);

    this.timer(() => {
      bullet.destroy();
    }, 10000);

    return bullet;
  }

  shoot() {
    const {level} = this;
    const {currentPlane} = level;

    if (level.changingPlanes) {
      this.selectedPlane();
      return;
    }

    if (currentPlane.winning) {
      return;
    }

    this.createBullet(currentPlane);
  }

  selectedPlane() {
    const {level} = this;
    const {planeIndex, availablePlanes} = level;

    level.changingPlanes = false;
    level.currentPlane = availablePlanes[planeIndex];
    this.cameraFollow(level.currentPlane);
  }

  createBooster(plane) {
    const booster = plane.booster = this.physics.add.sprite(plane.x, plane.y, 'booster');
    return booster;
  }

  setupPhysics() {
    const {level, physics} = this;
    const {groups, bullets} = level;
    const {wall, goal, plane} = groups;

    physics.add.collider(plane.group, wall.group, null, (...args) => this.overlapPlaneWall(...args));
    physics.add.collider(plane.group, plane.group, null, (...args) => this.overlapPlanePlane(...args));
    physics.add.overlap(plane.group, bullets, null, (...args) => this.overlapPlaneBullet(...args));
    physics.add.overlap(plane.group, goal.group, null, (...args) => this.overlapPlaneGoal(...args));
  }

  overlapPlaneGoal(plane, goal) {
    if (plane.winning) {
      return;
    }

    plane.winning = true;
  }

  damagePlane(plane, amount) {
    plane.damage += amount;
  }

  overlapPlaneBullet(plane, bullet) {
    if (bullet.shooter === plane) {
      return;
    }

    const damage = this.randBetween('damage', 10, 20);
    this.damagePlane(plane, damage);
    bullet.destroy();
  }

  overlapPlaneWall(plane, wall) {
    const {now} = this.time;

    const debounce = 100;
    const damage = this.randBetween('damage', 10, 20);
    if (now > (plane.planeCollideDebounce.wall || 0)) {
      this.damagePlane(plane, damage);
      plane.planeCollideDebounce.wall = now + debounce;
    } else {
      // debounce
      // return;
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

  setupAnimations() {
  }

  processInput(time, dt) {
    const {command, level} = this;
    const {currentPlane} = level;

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

    currentPlane.thrust = thrust;
    currentPlane.roll = roll;

    if (currentPlane.winning) {
      currentPlane.thrust = 0;
      currentPlane.roll = 0;
    }
  }

  selectInput(time, dt) {
    const {command, level} = this;

    let dIdx = 0;
    let stickInput;

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
    }

    if (dIdx && level.debouncePlaneSelect) {
      return;
    } else if (!dIdx) {
      level.debouncePlaneSelect = false;
      return;
    }

    const planes = level.availablePlanes;
    level.planeIndex = (level.planeIndex + planes.length + dIdx) % planes.length;
    const plane = planes[level.planeIndex];

    this.cameraFollow(plane);
    level.debouncePlaneSelect = true;
  }

  fixedUpdate(time, dt) {
    const {level} = this;
    const {complete, changingPlanes, planes} = level;

    if (complete) {
    } else if (changingPlanes) {
      this.selectInput(time, dt);
    } else {
      this.processInput(time, dt);

      planes.forEach((plane) => {
        if (!plane.nan && (isNaN(plane.x) || isNaN(plane.y))) {
          console.warn('plane is NaN\'d');
          plane.nan = true;
        }

        this.thrusters(plane, dt);
        this.tradeoff(plane, dt);
        this.ailerons(plane, dt);
        this.gravity(plane, dt);
        this.booster(plane, dt);
        this.relativity(plane, dt);
        this.drag(plane, dt);
        this.jelly(plane, dt);
      });
    }
  }

  renderUpdate(time, dt) {
    this.updateScore();
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

    level.availablePlanes = level.planes.filter((p) => !p.winning).sort((a, b) => b.x - a.x);

    if (!level.availablePlanes.length) {
      this.completeLevel();
      return;
    }

    level.planeIndex = 0;
    level.changingPlanes = true;
  }

  completeLevel() {
    const {level} = this;

    if (level.complete) {
      return;
    }

    level.complete = true;
    console.log('complete');
  }

  drag(plane, dt) {
    if (plane.winning) {
      plane.setVelocityX(plane.body.velocity.x * prop('physics.goalDrag'));
      plane.setVelocityY(plane.body.velocity.y * prop('physics.goalDrag'));
      return;
    }

    if (Math.abs(plane.thrust) < 0.01) {
      plane.setVelocityX(plane.body.velocity.x * prop('physics.drag'));
    }
  }

  relativity(plane, dt) {
    const {level} = this;
    const {gunThrust} = plane;

    const squish = prop('plane.squish');
    const factor = plane.thrust / squish;

    plane.squishFactor = factor * 0.9 + (plane.squishFactor || 0) * 0.1;
    plane.setScale(1 - plane.squishFactor, 1 + plane.squishFactor);

    if (plane === level.currentPlane) {
      this.timeScale = 1 + gunThrust * prop('physics.timeThrust');
      this.camera.zoom = 1 + gunThrust * prop('physics.zoomThrust');
    }
  }

  thrusters(plane, dt) {
    const desiredPercent = Math.max(0, plane.gunCooldown - this.time.now) / prop('gun.cooldown');
    const gunThrust = plane.gunThrust = desiredPercent * 0.1 + (plane.gunThrust || 0) * 0.9;
    plane.thrust += prop('gun.thrustBoost') * gunThrust;

    const max = (1 + prop('gun.thrustMax') * gunThrust) * prop('plane.maxVelocity');
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

    const theta = plane.theta = Angle2Theta(angle);
    plane.sin = Math.sin(theta);
    plane.cos = Math.cos(theta);

    plane.body.setAngularVelocity(roll * prop('plane.droll'));
  }

  gravity(plane, dt) {
    let ay = 0;
    let ax = 0;

    if (plane.thrust > 0) {
      if (!plane.winning) {
        ay = prop('plane.thrustGravity');
      }

      ay -= plane.thrust * prop('plane.power') * -1 * plane.cos;
      ax = plane.thrust * prop('plane.power') * -1 * plane.sin;
    } else if (!plane.winning) {
      ay = prop('plane.gravity');
    }

    plane.body.setAccelerationX(ax);
    plane.body.setAccelerationY(ay);
  }

  boosterPosition(plane, bonus = 0) {
    const {
      x, y, width, height, theta,
    } = plane;

    const bx = x + (width + bonus) * Math.sin(theta);
    const by = y + (height + bonus) * (-Math.cos(theta));
    return [bx, by];
  }

  booster(plane, dt) {
    const {booster} = plane;

    if (plane.thrust <= 0.01) {
      booster.alpha = 0;
      booster.bonus = 0;
    } else {
      booster.alpha = 1;
    }

    let distFactor = (Math.sin(this.command.up.heldFrames / prop('booster.bounce')) + 1) / 2;
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
