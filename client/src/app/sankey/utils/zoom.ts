import { ElementRef } from '@angular/core';

import { zoom as d3_zoom, ZoomedElementBaseType } from 'd3-zoom';
import { Selection, select as d3_select } from 'd3-selection';
import { ValueFn, ZoomTransform, Transition, zoomIdentity } from 'd3';
import { isBoolean, isArray, forOwn } from 'lodash-es';
import { combineLatest, Observable } from 'rxjs';
import { share } from 'rxjs/operators';

import { ExtendedMap } from 'app/shared/utils/types';
import { enumerable } from 'app/shared/utils/decorators';

type ZoomParams<ZoomRefElement extends ZoomedElementBaseType, Datum> = {
  [key in keyof Zoom<ZoomRefElement, Datum>]?: Zoom<ZoomRefElement, Datum>[key]
};

/**
 * Helper wrapper over d3 zoom behavior.
 */
export class Zoom<ZoomRefElement extends ZoomedElementBaseType, Datum> {
  constructor(elementRef: ElementRef<ZoomRefElement>, params: ZoomParams<ZoomRefElement, Datum>) {
    this.selection = d3_select(elementRef.nativeElement);
    forOwn(params, (value, key) => {
      if (this.hasOwnProperty(key)) {
        this[key] = value;
      }
    });
    this.bind();
  }

  @enumerable
  set initialTransform(initialTransform) {
    this._initialTransform = initialTransform;
    this.reset();
  }

  get initialTransform(): ZoomTransform {
    return this._initialTransform;
  }

  @enumerable
  set clickDistance(value: number) {
    this.zoom.clickDistance(value);
  }

  get clickDistance(): number {
    return this.zoom.clickDistance();
  }

  @enumerable
  set constrain(constraint) {
    this.zoom.constrain(constraint);
  }

  get constrain() {
    return this.zoom.constrain();
  }

  @enumerable
  set duration(duration: number) {
    this.zoom.duration(duration);
  }

  get duration(): number {
    return this.zoom.duration();
  }

  @enumerable
  set extent(extent: [[number, number], [number, number]]) {
    this.zoom.extent(extent);
  }

  get extent(): [[number, number], [number, number]] {
    return this.zoom.extent() as any as [[number, number], [number, number]];
  }

  @enumerable
  set filter(filterFn) {
    this.zoom.filter(filterFn);
  }

  get filter(): (d: any, i: number, group: any) => boolean {
    return this.zoom.filter();
  }

  @enumerable
  set interpolate(interpolatorFactory) {
    this.zoom.interpolate(interpolatorFactory);
  }

  get interpolate(): (a: any, b: any) => (t: number) => any {
    return this.zoom.interpolate();
  }

  @enumerable
  set scaleExtent(extent) {
    this.zoom.scaleExtent(extent);
  }

  get scaleExtent(): [number, number] {
    return this.zoom.scaleExtent();
  }

  @enumerable
  set touchable(touchable) {
    this.zoom.touchable(touchable);
  }

  get touchable() {
    return this.zoom.touchable();
  }

  @enumerable
  set translateExtent(extent) {
    this.zoom.translateExtent(extent);
  }

  get translateExtent(): [[number, number], [number, number]] {
    return this.zoom.translateExtent();
  }

  @enumerable
  set wheelDelta(delta: ValueFn<Element, {}, number>) {
    this.zoom.wheelDelta(delta);
  }

  get wheelDelta(): ValueFn<Element, {}, number> {
    return this.zoom.wheelDelta();
  }

  private zoom = d3_zoom();
  private transition: boolean | Transition<ZoomRefElement, any, any, any> | string;
  private selection: Selection<ZoomRefElement, any, any, any>;
  private listeners = new ExtendedMap<string, Observable<any>>();
  private _initialTransform: ZoomTransform = zoomIdentity;

  bind() {
    this.selection.call(this.zoom);
  }

  unbind() {
    this.selection.on('.zoom', null);
  }

  reset() {
    this.transform(this.initialTransform);
  }

  private onSingular$(typename) {
    return this.listeners.getSetLazily(typename, () =>
      new Observable<any>(subscriber => (
        this.zoom.on(typename, () => subscriber.next()),
        () => {
          this.zoom.on(typename, null);
          this.listeners.delete(typename);
        }
      )).pipe(share())
    );
  }

  on$(typenames: string | string[]) {
    if (isArray(typenames)) {
      return combineLatest(
        typenames.map(typename =>
          this.onSingular$(typename)
        )
      );
    } else {
      return this.onSingular$(typenames);
    }
  }

  getTrasitionableSelection(localyDeclaredTransition?) {
    const transition = localyDeclaredTransition ?? this.transition;
    if (isBoolean(transition)) {
      return transition ? this.selection.transition() : this.selection;
    } else {
      return this.selection.transition(transition);
    }
  }

  scaleBy(k: number,
          transition?: boolean) {
    this.zoom.scaleBy(this.getTrasitionableSelection(transition), k);
  }

  scaleTo(k: number | ValueFn<Element, {}, number>, p?: [number, number],
          transition?: boolean): void {
    this.zoom.scaleTo(this.getTrasitionableSelection(transition), k, p);
  }

  transform(transform: ZoomTransform | ValueFn<Element, {}, ZoomTransform>,
            point?: [number, number] | ValueFn<Element, {}, [number, number]>,
            transition?: boolean): void {
    this.zoom.transform(this.getTrasitionableSelection(transition), transform, point);
  }

  translateBy(x: number | ValueFn<Element, {}, number>,
              y: number | ValueFn<Element, {}, number>,
              transition?: boolean): void {
    this.zoom.translateBy(this.getTrasitionableSelection(transition), x, y);
  }

  translateTo(x: number | ValueFn<Element, {}, number>,
              y: number | ValueFn<Element, {}, number>,
              p?: [number, number] | ValueFn<Element, {}, [number, number]>,
              transition?: boolean): void {
    this.zoom.translateTo(this.getTrasitionableSelection(transition), x, y, p);
  }
}
