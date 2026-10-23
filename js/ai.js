// AI driver: follows the racing line, slows for corners, dodges cars and uses power-ups.

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function aiDrive(racer, race, dt) {
  const car = racer.car;
  const tr = race.track;
  const ai = racer.ai;
  const sp = Math.max(0, car.speed);
  const f = car.proj.f;

  // Preferred lane drifts slowly so the pack spreads out.
  ai.t += dt;
  let lane = ai.lane + Math.sin(ai.t * 0.35 + ai.seed) * 2.2;
  // Cut to the inside of upcoming corners (positive curvature = right-hand bend).
  const cAhead = tr.curv[tr.wrap(Math.floor(f + 16 / tr.spacing))];
  lane += Math.max(-1, Math.min(1, cAhead * 2)) * 3;

  // Dodge cars just ahead.
  for (const o of race.racers) {
    if (o === racer) continue;
    const d = tr.deltaIdx(f, o.car.proj.f) * tr.spacing;
    if (d > 0 && d < 14 && Math.abs(o.car.lateral - lane) < 2.6) {
      lane += o.car.lateral > lane ? -3.2 : 3.2;
      break;
    }
  }
  // Avoid oil slicks.
  for (const s of race.slicks) {
    const d = tr.deltaIdx(f, s.f) * tr.spacing;
    if (d > 0 && d < 30 && Math.abs(s.lat - lane) < 3) lane += s.lat > lane ? -4 : 4;
  }
  const hw = tr.width / 2 - 1.4;
  lane = Math.max(-hw, Math.min(hw, lane));
  ai.laneSmooth += (lane - ai.laneSmooth) * Math.min(1, dt * 2.5);

  const look = 8 + sp * 0.5;
  const target = tr.pointAt(f + look / tr.spacing, ai.laneSmooth);
  const desired = Math.atan2(target.x - car.pos.x, target.z - car.pos.z);
  const diff = wrapAngle(desired - car.heading);
  let steer = Math.max(-1, Math.min(1, -diff * 3.4));
  if (car.speed < -0.5) steer = -steer;

  // Plan a safe speed from the sharpest bend within the braking distance.
  let maxC = 0;
  const reach = 14 + sp * 1.1;
  for (let m = 6; m < reach; m += 5) {
    const c = Math.abs(tr.curv[tr.wrap(Math.floor(f + m / tr.spacing))]);
    if (c > maxC) maxC = c;
  }
  const turnRate = car.stats.turn * 0.78;
  const cornerSpeed = (turnRate * 12) / Math.max(0.02, maxC);
  const gripFactor = Math.sqrt(race.season.grip);
  const targetSpeed = Math.min(car.stats.speed * 1.5, cornerSpeed * gripFactor * (0.82 + 0.25 * ai.skill));

  let throttle = sp < targetSpeed ? 1 : 0;
  let brake = sp > targetSpeed + 4 ? 0.7 : 0;

  // Stuck or facing the wrong way: back up, then respawn if that doesn't help.
  const t = car.proj.tangent;
  const facing = t ? Math.sin(car.heading) * t.x + Math.cos(car.heading) * t.z : 1;
  ai.check -= dt;
  if (ai.check <= 0) {
    const moved = (racer.progress - ai.lastProgress) * tr.spacing;
    ai.stuck = race.started && moved < 6 && !racer.effects.spin ? ai.stuck + 1 : 0;
    ai.lastProgress = racer.progress;
    ai.check = 1;
  }
  if (facing < -0.3 && !racer.effects.spin) ai.wrong += dt;
  else ai.wrong = 0;
  if (ai.stuck === 2) {
    throttle = 0;
    brake = 1;
    steer = -steer;
  } else if (ai.stuck >= 3 || ai.wrong > 1.5) {
    race.respawn(racer);
    ai.stuck = 0;
    ai.wrong = 0;
  }

  car.input.throttle = throttle;
  car.input.brake = brake;
  car.input.steer = steer;

  // Power-ups.
  if (racer.item && !racer.isPlayer) {
    ai.itemTimer -= dt;
    if (ai.itemTimer <= 0) {
      ai.itemTimer = 0.5;
      ai.itemHeld += 0.5;
      const item = racer.item;
      const forced = ai.itemHeld > 8;
      let use = forced;
      if (item === 'boost') use = use || maxC < 0.25;
      else if (item === 'shield') use = true;
      else if (item === 'mud') use = use || race.racers.some((o) => o !== racer && o.progress > racer.progress && o.progress - racer.progress < 260 / tr.spacing);
      else if (item === 'oil') use = use || race.racers.some((o) => o !== racer && o.progress < racer.progress && racer.progress - o.progress < 50 / tr.spacing);
      if (use) {
        race.useItem(racer);
        ai.itemHeld = 0;
      }
    }
  }
}

export function makeAI(skill, lane) {
  return { skill, lane, laneSmooth: lane, t: 0, seed: Math.random() * 10, stuck: 0, wrong: 0, check: 1, lastProgress: -1e9, itemTimer: 1 + Math.random() * 2, itemHeld: 0 };
}
