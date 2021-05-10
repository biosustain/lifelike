import { ListRange } from '@angular/cdk/collections';

export class Point extends Array<number> {
  constructor(x: number = 0, y: number = 0) {
    super(x, y);
  }

  get x() {
    return this[0];
  }

  set x(v) {
    this[0] = v;
  }

  get y() {
    return this[1];
  }

  set y(v) {
    this[1] = v;
  }

  equals(to) {
    return this.every((v, i) => v === to[i]);
  }

  substract(subtrahend) {
    return new Point(
      ...this.map((v, i) => v - subtrahend[i])
    );
  }

  add(addend) {
    return new Point(
      ...this.map((v, i) => v - addend[i])
    );
  }

  multiply(multiplier) {
    return new Point(
      ...this.map((v, i) => v * multiplier[i])
    );
  }

  // @ts-ignore
  map(f): Point {
    return new Point(...Array.prototype.map.call(this, f));
  }
}

export class PointRange {
  start: Point;
  end: Point;

  constructor() {
    this.start = new Point();
    this.end = new Point();
  }

  get x(): ListRange {
    return {
      start: this.start.x,
      end: this.end.x
    };
  }

  set x(r: ListRange) {
    this.start.x = r.start;
    this.end.x = r.end;
  }

  get y(): ListRange {
    return {
      start: this.start.y,
      end: this.end.y
    };
  }

  set y(r: ListRange) {
    this.start.y = r.start;
    this.end.y = r.end;
  }

  equals(to) {
    return this.start.every((v, i) => v === to.start[i]) && this.end.every((v, i) => v === to.end[i]);
  }
}
