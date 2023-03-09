import { ElementRef } from "@angular/core";

import { zoom as d3_zoom, ZoomedElementBaseType } from "d3-zoom";
import { event as d3_event, select as d3_select, Selection } from "d3-selection";
import { Transition, ValueFn, ZoomBehavior, zoomIdentity, ZoomTransform } from "d3";
import { forOwn, isArray, isBoolean } from "lodash-es";
import { combineLatest, Observable } from "rxjs";
import { share } from "rxjs/operators";

import { ExtendedMap } from "app/shared/utils/types";

type ZoomParams<ZoomRefElement extends ZoomedElementBaseType, Datum> = {
  [key in keyof Zoom<ZoomRefElement, Datum>]?: Zoom<ZoomRefElement, Datum>[key];
};

/**
 * Helper wrapper over d3 zoom behavior.
 */
export class Zoom<ZoomRefElement extends ZoomedElementBaseType, Datum> {
  private zoom = d3_zoom();
  private transition: boolean | Transition<ZoomRefElement, any, any, any> | string;
  private selection: Selection<ZoomRefElement, any, any, any>;
  private listeners = new ExtendedMap<string, Observable<any>>();

  get clickDistance(): number {
    return this.zoom.clickDistance();
  }

  set clickDistance(value: number) {
    this.zoom.clickDistance(value);
  }

  get constrain() {
    return this.zoom.constrain();
  }

  set constrain(constraint) {
    this.zoom.constrain(constraint);
  }

  get duration(): number {
    return this.zoom.duration();
  }

  set duration(duration: number) {
    this.zoom.duration(duration);
  }

  get extent(): ValueFn<ZoomRefElement, Datum, [[number, number], [number, number]]> {
    return this.zoom.extent();
  }

  set extent(extent: ValueFn<ZoomRefElement, Datum, [[number, number], [number, number]]>) {
    this.zoom.extent(extent);
  }

  get filter(): (d: any, i: number, group: any) => boolean {
    return this.zoom.filter();
  }

  set filter(filterFn) {
    this.zoom.filter(filterFn);
  }

  get interpolate(): (a: any, b: any) => (t: number) => any {
    return this.zoom.interpolate();
  }

  set interpolate(interpolatorFactory) {
    this.zoom.interpolate(interpolatorFactory);
  }

  get scaleExtent(): [number, number] {
    return this.zoom.scaleExtent();
  }

  set scaleExtent(extent) {
    this.zoom.scaleExtent(extent);
  }

  get touchable() {
    return this.zoom.touchable();
  }

  set touchable(touchable) {
    this.zoom.touchable(touchable);
  }

  get translateExtent(): [[number, number], [number, number]] {
    return this.zoom.translateExtent();
  }

  set translateExtent(extent) {
    this.zoom.translateExtent(extent);
  }

  get wheelDelta(): ValueFn<Element, {}, number> {
    return this.zoom.wheelDelta();
  }

  set wheelDelta(delta: ValueFn<Element, {}, number>) {
    this.zoom.wheelDelta(delta);
  }

  private _initialTransform: ZoomTransform = zoomIdentity;

  get initialTransform(): ZoomTransform {
    return this._initialTransform;
  }

  set initialTransform(initialTransform) {
    this._initialTransform = initialTransform;
    this.reset();
  }

  constructor(elementRef: ElementRef<ZoomRefElement>, params: ZoomParams<ZoomRefElement, Datum>) {
    this.selection = d3_select(elementRef.nativeElement);
    forOwn(params, (value, key) => {
      if (key in this) {
        this[key] = value;
      }
    });
    this.bind();
  }

  bind() {
    this.selection.call(this.zoom);
  }

  unbind() {
    this.selection.on(".zoom", null);
  }

  reset() {
    this.transform(this.initialTransform);
  }

  on$(typenames: string | string[]) {
    if (isArray(typenames)) {
      return combineLatest(typenames.map((typename) => this.onSingular$(typename)));
    } else {
      return this.onSingular$(typenames);
    }
  }

  getTrasitionableSelection(localyDeclaredTransition?) {
    const transition = localyDeclaredTransition ?? this.transition;
    if (transition) {
      return isBoolean(transition)
        ? this.selection.transition()
        : this.selection.transition(transition);
    } else {
      return this.selection;
    }
  }

  scaleBy(k: number, p?: [number, number], transition?: boolean) {
    const args: Parameters<ZoomBehavior<any, any>["scaleTo"]> = [
      this.getTrasitionableSelection(transition),
      k,
    ];
    if (p) {
      args.push(p);
    }
    this.zoom.scaleBy(...args);
  }

  scaleTo(
    k: number | ValueFn<Element, {}, number>,
    p?: [number, number],
    transition?: boolean
  ): void {
    const args: Parameters<ZoomBehavior<any, any>["scaleTo"]> = [
      this.getTrasitionableSelection(transition),
      k,
    ];
    if (p) {
      args.push(p);
    }
    // d3 counts arguments so passing undefined is not an option
    this.zoom.scaleTo(...args);
  }

  transform(
    transform: ZoomTransform | ValueFn<Element, {}, ZoomTransform>,
    point?: [number, number] | ValueFn<Element, {}, [number, number]>,
    transition?: boolean
  ): void {
    this.zoom.transform(this.getTrasitionableSelection(transition), transform, point);
  }

  translateBy(
    x: number | ValueFn<Element, {}, number>,
    y: number | ValueFn<Element, {}, number>,
    transition?: boolean
  ): void {
    this.zoom.translateBy(this.getTrasitionableSelection(transition), x, y);
  }

  translateTo(
    x: number | ValueFn<Element, {}, number>,
    y: number | ValueFn<Element, {}, number>,
    p?: [number, number] | ValueFn<Element, {}, [number, number]>,
    transition?: boolean
  ): void {
    this.zoom.translateTo(this.getTrasitionableSelection(transition), x, y, p);
  }

  private onSingular$(typename) {
    return this.listeners.getSetLazily(typename, () =>
      new Observable<any>(
        (subscriber) => (
          this.zoom.on(typename, () => subscriber.next(d3_event)),
          () => {
            this.zoom.on(typename, null);
            this.listeners.delete(typename);
          }
        )
      ).pipe(share())
    );
  }
}
