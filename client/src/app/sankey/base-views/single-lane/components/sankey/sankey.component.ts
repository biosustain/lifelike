import { AfterViewInit, Component, OnDestroy, ViewEncapsulation, OnInit, ElementRef, NgZone } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { select as d3_select } from 'd3-selection';
import { map, switchMap, takeUntil, publish, tap, finalize } from 'rxjs/operators';
import { forkJoin, combineLatest, merge, of, Observable } from 'rxjs';
import { first } from 'lodash-es';

import { SankeyNode, SankeyLink } from 'app/sankey/interfaces';
import { mapIterable } from 'app/shared/utils';
import { d3EventCallback } from 'app/shared/utils/d3';
import { LayoutService } from 'app/sankey/services/layout.service';
import { ClipboardService } from 'app/shared/services/clipboard.service';
import { SankeySelectionService } from 'app/sankey/services/selection.service';
import { SankeySearchService } from 'app/sankey/services/search.service';
import { updateAttrSingular, updateAttr } from 'app/sankey/utils/rxjs';
import { debug } from 'app/shared/rxjs/debug';
import { SelectionEntity, SelectionType } from 'app/sankey/interfaces/selection';

import { SankeySingleLaneLink, SankeySingleLaneOptions, SankeySingleLaneState } from '../../interfaces';
import { SankeyAbstractComponent } from '../../../../abstract/sankey.component';
import { SingleLaneLayoutService } from '../../services/single-lane-layout.service';
import { EntityType } from '../../../../interfaces/search';

type SankeyEntity = SankeyNode | SankeyLink;

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
  extends SankeyAbstractComponent<SankeySingleLaneOptions, SankeySingleLaneState>
  implements OnInit, AfterViewInit, OnDestroy {
  constructor(
    readonly clipboard: ClipboardService,
    readonly snackBar: MatSnackBar,
    readonly sankey: SingleLaneLayoutService,
    readonly wrapper: ElementRef,
    protected zone: NgZone,
    protected selection: SankeySelectionService,
    protected search: SankeySearchService
  ) {
    super(clipboard, snackBar, sankey, wrapper, zone, selection, search);
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
        comparator: (id, {_id}) => id == _id
      }
    )
  );
  // region Select

  $getConnectedNodesAndLinks = switchMap((data: SankeyEntity) => {
    if (!data) {
      return of({nodesIds: new Set(), linksIds: new Set()});
    }
    const traversalId = data._id;
    const leftNode = ((data as SankeyLink)._source ?? data) as SankeyNode;
    const rightNode = ((data as SankeyLink)._target ?? data) as SankeyNode;

    return this.sankey.baseView.highlightCircular$.pipe(
      map(highlightCircular => {
        const helper = {
          left: {
            graphRelativePosition: 'left',
            nextNode: '_source',
            nextLinks: '_targetLinks',
            traversedLinks: new Set<SankeySingleLaneLink>()
          },
          right: {
            graphRelativePosition: 'right',
            nextNode: '_target',
            nextLinks: '_sourceLinks',
            traversedLinks: new Set<SankeySingleLaneLink>()
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
          node[nextLinks].forEach((l: SankeySingleLaneLink) => {
            const had = traversedLinks.has(l);
            if (!had && (highlightCircular || !l._circular)) {
              traversedLinks.add(l);
              l._graphRelativePosition = l._visited === traversalId ? 'multiple' : graphRelativePosition;
              l._visited = traversalId;
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

        links.forEach(l => delete l._visited);
        delete (data as SankeySingleLaneLink)._graphRelativePosition;
        links.add((data as SankeySingleLaneLink));

        return {
          nodesIds: mapIterable(nodes, ({_id}) => _id),
          linksIds: mapIterable(links, ({_id}) => _id)
        };
      })
    );
  });

  selectionUpdate$ = this.selection.selection$.pipe(
    // this base view operates on sigular selection
    publish((selection$: Observable<SelectionEntity>) => merge(
      selection$.pipe(
        map(({type, entity}) => type === SelectionType.node && entity),
        updateAttrSingular(this.renderedNodes$, 'selected', (entity, {_id}) => (entity as SankeyNode)._id === _id),
        debug('nodeSelection')
      ),
      selection$.pipe(
        map(({type, entity}) => type === SelectionType.link && entity),
        updateAttrSingular(this.renderedLinks$, 'selected', (entity, {_id}) => (entity as SankeyLink)._id === _id),
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
            accessor: (nodesIds, {_id}) => nodesIds.has(_id),
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
            accessor: (linksIds, {_id}) => linksIds.has(_id),
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
      takeUntil(this.destroy$)
    ).subscribe();
  }

  initFocus() {
    forkJoin(
      this.focusedLink$,
      this.focusedNode$
    ).pipe(
      takeUntil(this.destroy$)
    ).subscribe();
  }

  ngAfterViewInit() {
    super.ngAfterViewInit();
  }

  ngOnDestroy() {
    super.ngOnDestroy();
  }

  panToLink({_y0, _y1, _source: {_x1}, _target: {_x0}}) {
      this.zoom.translateTo(
      // x
      (_x1 + _x0) / 2,
      // y
      (_y0 + _y1) / 2,
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
