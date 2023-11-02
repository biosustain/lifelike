import {
  AfterViewInit,
  Directive,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  Renderer2,
  SimpleChanges,
} from '@angular/core';

import {
  BoundingBox,
  ClusterOptions,
  Data,
  DirectionType,
  EdgeOptions,
  FitOptions,
  FocusOptions,
  IdType,
  MoveToOptions,
  Network,
  NetworkEvents,
  NodeOptions,
  OpenClusterOptions,
  Options,
  Position,
  SelectionOptions,
} from 'vis-network';
import { Observable, ReplaySubject } from 'rxjs';
import { shareReplay, switchMap } from 'rxjs/operators';

@Directive({
  selector: 'app-vis-network[data][options],  [appVisNetwork][data][options]',
})
export class VisNetworkDirective implements Network, OnChanges, AfterViewInit, OnDestroy {
  /**
   * Versatile yet simple wrapper, implementing vis-network Network class as Angular component/directive.
   * It allows to use vis-network in Angular templates in a declarative way.
   * To avoid name conflicts all events has been prefixed with 'network' word.
   *
   * Examples of usage in templates:
   * ```html
   *    <app-vis-network [data]="data" [options]="options"></app-vis-network>
   *    <div appVisNetwork [data]="data" [options]="options"></div>
   *    <app-vis-network [data]="data" [options]="options" (networkClick)="click($event)"></app-vis-network>
   *    <div appVisNetwork [data]="data" [options]="options" (networkClick)="click($event)"></div>
   * ```
   *
   * Example of usage in component class:
   * ```ts
   *    @ViewChild(VisNetworkDirective) networkInstance: VisNetworkDirective;
   *    this.networkInstance.network.fit();
   * ```
   *
   * Example of usage in component class handling events outside Angular zone:
   * ```ts
   *    @ViewChild(VisNetworkDirective) networkInstance: VisNetworkDirective;
   *    this.networkInstance.network.on('click', (params) => this.click(params));
   * ```
   *
   * [See official vis-network documentation for details on methods and events.](https://visjs.github.io/vis-network/docs/network/)
   */
  constructor(private readonly element: ElementRef, private readonly renderer: Renderer2) {
    // Set display to block to allow setting width and height
    // TODO: This could be write to not overwrite diferent acceptable display values like inline-block
    this.renderer.setStyle(element.nativeElement, 'display', 'block');
  }

  @Input() data!: Data;
  @Input() options!: Options;
  private _network: Network; // current vis-network instance, used to implement all methods
  private _network$ = new ReplaySubject<Network>(1); // used to implement all events
  // tslint:disable-next-line:no-output-rename
  @Output('network') network$ = this._network$.asObservable();

  get network(): Network {
    return this._network;
  }

  set network(network: Network) {
    this._network?.destroy();
    this._network = network;
    this._network$.next(network);
  }

  // region Network Events proxies
  /**
   * WARNING: These proxies will run in angular zone, so they will trigger change detection.
   * If you want to avoid this, use VisNetworkDirective.on('eventName', callback) instead.
   */
  @Output() readonly networkClick = this.networkEventToEventEmitter('click');
  @Output() readonly networkDoubleClick = this.networkEventToEventEmitter('doubleClick');
  @Output() readonly networkOnContext = this.networkEventToEventEmitter('oncontext');
  @Output() readonly networkHold = this.networkEventToEventEmitter('hold');
  @Output() readonly networkRelease = this.networkEventToEventEmitter('release');
  @Output() readonly networkSelect = this.networkEventToEventEmitter('select');
  @Output() readonly networkSelectNode = this.networkEventToEventEmitter('selectNode');
  @Output() readonly networkSelectEdge = this.networkEventToEventEmitter('selectEdge');
  @Output() readonly networkDeselectNode = this.networkEventToEventEmitter('deselectNode');
  @Output() readonly networkDeselectEdge = this.networkEventToEventEmitter('deselectEdge');
  @Output() readonly networkDragStart = this.networkEventToEventEmitter('dragStart');
  @Output() readonly networkDragging = this.networkEventToEventEmitter('dragging');
  @Output() readonly networkDragEnd = this.networkEventToEventEmitter('dragEnd');
  @Output() readonly networkControlNodeDragging =
    this.networkEventToEventEmitter('controlNodeDragging');
  @Output() readonly networkControlNodeDragEnd =
    this.networkEventToEventEmitter('controlNodeDragEnd');
  @Output() readonly networkHoverNode = this.networkEventToEventEmitter('hoverNode');
  @Output() readonly networkBlurNode = this.networkEventToEventEmitter('blurNode');
  @Output() readonly networkHoverEdge = this.networkEventToEventEmitter('hoverEdge');
  @Output() readonly networkBlurEdge = this.networkEventToEventEmitter('blurEdge');
  @Output() readonly networkZoom = this.networkEventToEventEmitter('zoom');
  @Output() readonly networkShowPopup = this.networkEventToEventEmitter('showPopup');
  @Output() readonly networkHidePopup = this.networkEventToEventEmitter('hidePopup');
  @Output() readonly networkStartStabilizing = this.networkEventToEventEmitter('startStabilizing');
  @Output() readonly networkStabilizationProgress =
    this.networkEventToEventEmitter('stabilizationProgress');
  @Output() readonly networkStabilizationIterationsDone = this.networkEventToEventEmitter(
    'stabilizationIterationsDone'
  );
  @Output() readonly networkStabilized = this.networkEventToEventEmitter('stabilized');
  @Output() readonly networkResize = this.networkEventToEventEmitter('resize');
  @Output() readonly networkInitRedraw = this.networkEventToEventEmitter('initRedraw');
  @Output() readonly networkBeforeDrawing = this.networkEventToEventEmitter('beforeDrawing');
  @Output() readonly networkAfterDrawing = this.networkEventToEventEmitter('afterDrawing');
  @Output() readonly networkAnimationFinished =
    this.networkEventToEventEmitter('animationFinished');
  @Output() readonly networkConfigChange = this.networkEventToEventEmitter('configChange');

  private networkEventToEventEmitter(eventName: NetworkEvents) {
    return this._network$.pipe(
      switchMap(
        (network) =>
          new Observable<any>((subscriber) => {
            const callback = (e: any) => subscriber.next(e);
            network.on(eventName, callback);

            return function unsubscribe() {
              network.off(eventName, callback);
            };
          })
      ),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }
  // endregion

  // region Lifecycle
  ngOnChanges({ data, options }: SimpleChanges) {
    if (data && !data.firstChange) {
      // initial value is set in ngAfterViewInit
      this._network.setData(data.currentValue);
    }
    if (options && !options.firstChange) {
      // initial value is set in ngAfterViewInit
      this._network.setOptions(options.currentValue);
    }
  }

  ngAfterViewInit() {
    this._network = new Network(this.element.nativeElement, this.data, this.options);
  }

  ngOnDestroy() {
    this._network?.destroy();
  }
  // endregion

  // region Network methods proxy
  DOMtoCanvas(position: Position): Position {
    return this._network.DOMtoCanvas(position);
  }

  addEdgeMode(): void {
    this._network.addEdgeMode();
  }

  addNodeMode(): void {
    this._network.addNodeMode();
  }

  canvasToDOM(position: Position): Position {
    return this._network.canvasToDOM(position);
  }

  cluster(options?: ClusterOptions): void {
    this._network.cluster(options);
  }

  clusterByConnection(nodeId: string, options?: ClusterOptions): void {
    this._network.clusterByConnection(nodeId, options);
  }

  clusterByHubsize(hubsize?: number, options?: ClusterOptions): void {
    this._network.clusterByHubsize(hubsize, options);
  }

  clusterOutliers(options?: ClusterOptions): void {
    this._network.clusterOutliers(options);
  }

  deleteSelected(): void {
    this._network.deleteSelected();
  }

  destroy(): void {
    this._network.destroy();
  }

  disableEditMode(): void {
    this._network.disableEditMode();
  }

  editEdgeMode(): void {
    this._network.editEdgeMode();
  }

  editNode(): void {
    this._network.editNode();
  }

  enableEditMode(): void {
    this._network.enableEditMode();
  }

  findNode(nodeId: IdType): IdType[] {
    return this._network.findNode(nodeId);
  }

  fit(options?: FitOptions): void {
    this._network.fit(options);
  }

  focus(nodeId: IdType, options?: FocusOptions): void {
    this._network.focus(nodeId, options);
  }

  getBaseEdge(clusteredEdgeId: IdType): IdType {
    return this._network.getBaseEdge(clusteredEdgeId);
  }

  getBaseEdges(clusteredEdgeId: IdType): IdType[] {
    return this._network.getBaseEdges(clusteredEdgeId);
  }

  getBoundingBox(nodeId: IdType): BoundingBox {
    return this._network.getBoundingBox(nodeId);
  }

  getClusteredEdges(baseEdgeId: IdType): IdType[] {
    return this._network.getClusteredEdges(baseEdgeId);
  }

  getConnectedEdges(nodeId: IdType): IdType[] {
    return this._network.getConnectedEdges(nodeId);
  }

  getConnectedNodes(
    nodeOrEdgeId: IdType,
    direction?: DirectionType
  ):
    | IdType[]
    | Array<{
        fromId: IdType;
        toId: IdType;
      }> {
    return this._network.getConnectedNodes(nodeOrEdgeId, direction);
  }

  getEdgeAt(position: Position): IdType {
    return this._network.getEdgeAt(position);
  }

  getNodeAt(position: Position): IdType {
    return this._network.getNodeAt(position);
  }

  getNodesInCluster(clusterNodeId: IdType): IdType[] {
    return this._network.getNodesInCluster(clusterNodeId);
  }

  getOptionsFromConfigurator(): any {
    return this._network.getOptionsFromConfigurator();
  }

  getPosition(nodeId: IdType): Position {
    return this._network.getPosition(nodeId);
  }

  getPositions(nodeIds?: IdType[] | IdType): { [p: string]: Position } {
    return this._network.getPositions(nodeIds);
  }

  getScale(): number {
    return this._network.getScale();
  }

  getSeed(): number | string {
    return this._network.getSeed();
  }

  getSelectedEdges(): IdType[] {
    return this._network.getSelectedEdges();
  }

  getSelectedNodes(): IdType[] {
    return this._network.getSelectedNodes();
  }

  getSelection(): { nodes: IdType[]; edges: IdType[] } {
    return this._network.getSelection();
  }

  getViewPosition(): Position {
    return this._network.getViewPosition();
  }

  isCluster(nodeId: IdType): boolean {
    return this._network.isCluster(nodeId);
  }

  moveNode(nodeId: IdType, x: number, y: number): void {
    this._network.moveNode(nodeId, x, y);
  }

  moveTo(options: MoveToOptions): void {
    this._network.moveTo(options);
  }

  off(eventName: NetworkEvents, callback?: (params?: any) => void): void {
    this._network.off(eventName, callback);
  }

  on(eventName: NetworkEvents, callback: (params?: any) => void): void {
    this._network.on(eventName, callback);
  }

  once(eventName: NetworkEvents, callback: (params?: any) => void): void {
    this._network.once(eventName, callback);
  }

  openCluster(nodeId: IdType, options?: OpenClusterOptions): void {
    this._network.openCluster(nodeId, options);
  }

  redraw(): void {
    this._network.redraw();
  }

  releaseNode(): void {
    this._network.releaseNode();
  }

  selectEdges(edgeIds: IdType[]): void {
    this._network.selectEdges(edgeIds);
  }

  selectNodes(nodeIds: IdType[], highlightEdges?: boolean): void {
    this._network.selectNodes(nodeIds, highlightEdges);
  }

  setData(data: Data): void {
    this._network.setData(data);
  }

  setOptions(options: Options): void {
    this._network.setOptions(options);
  }

  setSelection(
    selection: {
      nodes?: IdType[];
      edges?: IdType[];
    },
    options?: SelectionOptions
  ): void {
    this._network.setSelection(selection, options);
  }

  setSize(width: string, height: string): void {
    this._network.setSize(width, height);
  }

  stabilize(iterations?: number): void {
    this._network.stabilize(iterations);
  }

  startSimulation(): void {
    this._network.startSimulation();
  }

  stopSimulation(): void {
    this._network.stopSimulation();
  }

  storePositions(): void {
    this._network.storePositions();
  }

  unselectAll(): void {
    this._network.unselectAll();
  }

  updateClusteredNode(clusteredNodeId: IdType, options?: NodeOptions): void {
    this._network.updateClusteredNode(clusteredNodeId, options);
  }

  updateEdge(startEdgeId: IdType, options?: EdgeOptions): void {
    this._network.updateEdge(startEdgeId, options);
  }
  // endregion
}
