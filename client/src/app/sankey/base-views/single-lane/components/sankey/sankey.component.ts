import { AfterViewInit, Component, OnDestroy, ViewEncapsulation, OnInit, ElementRef, NgZone, isDevMode } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { select as d3_select } from 'd3-selection';
import { map, switchMap, takeUntil, publish, tap } from 'rxjs/operators';
import { forkJoin, combineLatest, merge, of, Observable } from 'rxjs';
import { first } from 'lodash-es';
import { color as d3color } from 'd3-color';

import { mapIterable } from 'app/shared/utils';
import { d3EventCallback } from 'app/shared/utils/d3';
import { LayoutService } from 'app/sankey/services/layout.service';
import { ClipboardService } from 'app/shared/services/clipboard.service';
import { SankeySelectionService } from 'app/sankey/services/selection.service';
import { SankeySearchService } from 'app/sankey/services/search.service';
import { updateAttrSingular, updateAttr } from 'app/sankey/utils/rxjs';
import { debug } from 'app/shared/rxjs/debug';
import { SelectionEntity, SelectionType } from 'app/sankey/interfaces/selection';
import EdgeColorCodes from 'app/shared/styles/EdgeColorCode';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';

import { SankeyAbstractComponent } from '../../../../abstract/sankey.component';
import { SingleLaneLayoutService } from '../../services/single-lane-layout.service';
import { EntityType } from '../../../../interfaces/search';
import { ErrorMessages } from '../../../../constants/error';
import { SankeyUpdateService } from '../../../../services/sankey-update.service';
import { Base } from '../../interfaces';

type SankeyEntity = Base['node'] | Base['link'];

@Component({
  selector: 'app-sankey-single-lane',
  templateUrl: '../../../../abstract/sankey.component.svg',
  styleUrls: ['./sankey.component.scss'],
  encapsulation: ViewEncapsulation.None,
  providers: [
    SingleLaneLayoutService,
    {
      provide: LayoutService,
      useExisting: SingleLaneLayoutService,
    }
  ],
})
export class SankeySingleLaneComponent
  extends SankeyAbstractComponent<Base>
  implements OnInit, AfterViewInit, OnDestroy {
  constructor(
    readonly clipboard: ClipboardService,
    readonly snackBar: MatSnackBar,
    readonly sankey: SingleLaneLayoutService,
    readonly wrapper: ElementRef,
    protected zone: NgZone,
    protected selection: SankeySelectionService,
    protected search: SankeySearchService,
    readonly warningController: WarningControllerService,
    protected readonly updateController: SankeyUpdateService
  ) {
    super(clipboard, snackBar, sankey, wrapper, zone, selection, search, updateController);
    selection.multiselect = false;
  }

  focusedLink$ = this.search.searchFocus$.pipe(
    map(({type, id}) =>
      type === EntityType.Link && id
    ),
    debug('focusedLink$'),
    updateAttrSingular(
      this.renderedLinks$,
      'focused',
      {
        enter: s => s.attr('focused', true).raise().call(linkElement =>
          linkElement.size() && this.panToLink(first(linkElement.data()))
        ),
        // allow string == number match interpolation ("58" == 58 -> true)
        // tslint:disable-next-line:triple-equals
        comparator: (id, link) => link.id == id
      }
    )
  );
  // region Select

  $getConnectedNodesAndLinks = switchMap((data: SankeyEntity) => {
    if (!data) {
      return of({nodesIds: new Set(), linksIds: new Set()});
    }
    const traversalId = data.id;
    const leftNode = ((data as Base['link']).source ?? data) as Base['node'];
    const rightNode = ((data as Base['link']).target ?? data) as Base['node'];

    return this.sankey.baseView.highlightCircular$.pipe(
      map(highlightCircular => {
        const helper = {
          left: {
            graphRelativePosition: 'left',
            nextNode: 'source',
            nextLinks: 'targetLinks',
            traversedLinks: new Set<Base['link']>()
          },
          right: {
            graphRelativePosition: 'right',
            nextNode: 'target',
            nextLinks: 'sourceLinks',
            traversedLinks: new Set<Base['link']>()
          }
        };
        const nodes = new Set([leftNode, rightNode]);
        const objects2traverse = new Set([
          {
            direction: 'left',
            node: leftNode
          },
          {
            direction: 'right',
            node: rightNode
          }
        ]);

        for (const {direction, node} of objects2traverse) {
          const {
            graphRelativePosition, nextNode, nextLinks, traversedLinks
          } = helper[direction];
          node[nextLinks].forEach((l: Base['link']) => {
            const had = traversedLinks.has(l);
            if (!had && (highlightCircular || !l.circular)) {
              traversedLinks.add(l);
              l.graphRelativePosition = l.visited === traversalId ? 'multiple' : graphRelativePosition;
              l.visited = traversalId;
              nodes.add(l[nextNode]);
              objects2traverse.add({
                direction,
                node: l[nextNode]
              });
            }
          });
        }


        const links = new Set([
          ...helper.left.traversedLinks,
          ...helper.right.traversedLinks
        ]);

        links.forEach(l => delete l.visited);
        delete (data as Base['link']).graphRelativePosition;
        links.add((data as Base['link']));

        return {
          nodesIds: mapIterable(nodes, ({id}) => id),
          linksIds: mapIterable(links, ({id}) => id)
        };
      })
    );
  });

  selectionUpdate$ = this.selection.selection$.pipe(
    // this base view operates on sigular selection
    publish((selection$: Observable<SelectionEntity>) => merge(
      selection$.pipe(
        map(({type, entity}) => type === SelectionType.node && entity),
        updateAttrSingular(this.renderedNodes$, 'selected', (entity, {id}) => (entity as Base['node']).id === id),
        debug('nodeSelection')
      ),
      selection$.pipe(
        map(({type, entity}) => type === SelectionType.link && entity),
        updateAttrSingular(this.renderedLinks$, 'selected', (entity, {id}) => (entity as Base['link']).id === id),
        debug('linkSelection')
      )
      // selection$.pipe(
      //   map(({type, entity}) => type === SelectionType.trace && entity),
      //   debug('traceSelection')
      //   // todo
      // )
    )),
    debug('selectionUpdate$'),
    this.$getConnectedNodesAndLinks,
    publish(connectedNodesAndLinks$ => combineLatest([
      connectedNodesAndLinks$.pipe(
        map(({nodesIds}) => nodesIds),
        updateAttr(
          this.renderedNodes$,
          'transitively-selected',
          {
            accessor: (nodesIds, {id}) => nodesIds.has(id),
          }
        ),
        debug('transnodeSelection')
      ),
      connectedNodesAndLinks$.pipe(
        map(({linksIds}) => linksIds),
        updateAttr(
          this.renderedLinks$,
          'transitively-selected',
          {
            accessor: (linksIds, {id}) => linksIds.has(id),
            enter: s => s
              .attr('transitively-selected', ({_graphRelativePosition}) => _graphRelativePosition ?? true)
              .raise()
          }
        ),
        debug('translinkSelection')
      )
    ])),
    debug('transSelection')
  );

  ngOnInit() {
    super.ngOnInit();
  }

  initSelection() {
    this.selectionUpdate$.pipe(
      takeUntil(this.destroyed$)
    ).subscribe();
  }

  initStateUpdate() {
    const {warningController} = this;
    this.sankey.baseView.colorLinkByType$.pipe(
      takeUntil(this.destroyed$),
      switchMap(colorLinkByType =>
        this.renderedLinks$.pipe(
          // if fresh start update all, if re-render update only new
          map((linkSelection, iterationCount) => iterationCount === 0 ? linkSelection : linkSelection.enter()),
          tap(linksSelection => {
              if (colorLinkByType) {
                linksSelection
                  .each(function({label}) {
                    const color = EdgeColorCodes[label.toLowerCase()];
                    const stroke = color ? d3color(color).darker(0.5) : color;
                    if (isDevMode()) {
                      // This warning should not appear in prod "by design", yet it might be important for debugging
                      warningController.assert(color, ErrorMessages.noColorMapping(label));
                    }
                    return d3_select(this)
                      .style('stroke', stroke)
                      .style('fill', color);
                  });
              } else {
                linksSelection
                  .style('stroke', undefined)
                  .style('fill', undefined);
              }
            }
          )
        )
      )
    ).subscribe();
  }

  initFocus() {
    forkJoin(
      this.focusedLink$,
      this.focusedNode$
    ).pipe(
      takeUntil(this.destroyed$)
    ).subscribe();
  }

  ngAfterViewInit() {
    super.ngAfterViewInit();
  }

  ngOnDestroy() {
    super.ngOnDestroy();
  }

  panToLink({y0, y1, source: {x1}, target: {x0}}) {
    this.zoom.translateTo(
      // x
      (x1 + x0) / 2,
      // y
      (y0 + y1) / 2,
      undefined,
      true
    );
  }

  @d3EventCallback
  async pathMouseOver(element, data) {
    this.highlightLink(element);
  }

  @d3EventCallback
  async pathMouseOut(_element, _data) {
    this.unhighlightNodes();
    this.unhighlightLinks();
  }

  @d3EventCallback
  async nodeMouseOut(element, _data) {
    this.unhighlightNode(element);
    this.unhighlightNodes();
    this.unhighlightLinks();
  }

  // region Highlight
  highlightLink(element) {
    d3_select(element)
      .raise()
      .attr('highlighted', true);
  }


  highlightNode(element) {
    const selection = d3_select(element)
      .raise()
      .attr('highlighted', true)
      .select('g')
      .call(this.extendNodeLabel);
    // postpone so the size is known
    requestAnimationFrame(() =>
      selection
        .each(SankeyAbstractComponent.updateTextShadow)
    );
  }

  // endregion
}
