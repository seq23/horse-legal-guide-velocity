// One rule for every length, word or character limit in this repo (owner
// ruling, personal brain, 2 Nov 2026): over a limit never fails; under a floor
// fails only below 75% of it. Generators trim to fit; checks read this file
// instead of carrying their own numbers.
const FLOOR_SHARE = 0.75;

/** The smallest value that still passes a floor: 75% of it, rounded up. */
function hardFloor(floor) {
  return Math.ceil(floor * FLOOR_SHARE);
}

/** True only when a value is below 75% of its floor, the one case that fails. */
function belowFloor(value, floor) {
  return value < hardFloor(floor);
}

module.exports = { FLOOR_SHARE, hardFloor, belowFloor };
