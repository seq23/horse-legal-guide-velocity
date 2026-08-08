'use strict';
const RealDate = global.Date;
const raw = process.env.BUILD_TIMESTAMP;
if (raw) {
  const fixedMs = RealDate.parse(raw);
  if (!Number.isFinite(fixedMs)) throw new Error(`Invalid BUILD_TIMESTAMP: ${raw}`);
  class FrozenDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(fixedMs);
      else super(...args);
    }
    static now() { return fixedMs; }
    static parse(value) { return RealDate.parse(value); }
    static UTC(...args) { return RealDate.UTC(...args); }
  }
  global.Date = FrozenDate;
}
