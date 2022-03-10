import { AfterViewInit, Component, OnDestroy, ViewEncapsulation, OnInit, ElementRef, NgZone } from '@angular/core';

import { select as d3_select } from 'd3-selection';
import { startWith, pairwise, map, tap, switchMap, takeUntil, first, filter } from 'rxjs/operators';
import { forkJoin } from 'rxjs';
import { last } from 'lodash-es';

import { SankeyNode, SankeyLink, SelectionType } from 'app/sankey/interfaces';
import { mapIterable, isNotEmpty } from 'app/shared/utils';
import { d3EventCallback } from 'app/shared/utils/d3';
import { LayoutService } from 'app/sankey/services/layout.service';

import { SankeySingleLaneLink, SankeySingleLaneOptions, SankeySingleLaneState } from '../../interfaces';
import { SankeyAbstractComponent } from '../../../../abstract/sankey.component';
import { SingleLaneLayoutService } from '../../services/single-lane-layout.service';
import { EntityType } from '../../../../utils/search/search-match';
import { ClipboardService } from 'app/shared/services/clipboard.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SankeySelectionService } from 'app/sankey/services/selection.service';
import { SankeySearchService } from 'app/sankey/services/search.service';

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
  }

  focusedLink$ = this.sankey.graph$.pipe(
    switchMap(({links}) => this.search.searchFocus$.pipe(
        map(({type, id}) =>
          type === EntityType.Link &&
          // allow string == number match interpolation ("58" == 58 -> true)
          // tslint:disable-next-line:triple-equals
          (links as SankeySingleLaneLink[]).find(({_id}) => _id == id)
        ),
        startWith(undefined),
        pairwise()
      )
    ),
    tap(prevNext =>
      this.linkSelection
        .filter(link => prevNext.includes(link))
        .each(function(link) {
          const add = link === prevNext[1]; // equal to new focus
          const linkSelection = d3_select(this);
          linkSelection
            .attr('focused', add || undefined);
          if (add) {
            linkSelection
              .raise();
          }
        })
    )
  );

  // region Select

  selectionUpdate$ = this.selection.selection$.pipe(
    // this base view operates on sigular selection
    map(selection => last(selection)),
    tap(selection => {
      if (selection) {
        const {entity, type} = selection;
        switch (type) {
          case SelectionType.node:
            this.linkSelection.attr('selected', false);
            this.assignAttrAndRaise(this.nodeSelection, 'selected', ({_id}) => (entity as SankeyNode)._id === _id);
            break;
          case SelectionType.link:
            this.nodeSelection.attr('selected', false);
            this.assignAttrAndRaise(this.linkSelection, 'selected', ({_id}) => (entity as SankeyLink)._id === _id);
            break;
        }
        this.calculateAndApplyTransitiveConnections(entity);
      } else {
        // delete selection attributes
        this.nodeSelection
          .attr('selected', undefined)
          .attr('transitively-selected', undefined);
        this.linkSelection
          .attr('selected', undefined)
          .attr('transitively-selected', undefined);
      }
    })
  );

  ngOnInit() {
    // If there is selection when opening the view, reduce it to last selected entity
    // this baseview supports only single selection
    this.selection.selection$.pipe(
      first(),
      filter(isNotEmpty),
      tap(selection => this.selection.selection$.next([last(selection)]))
    ).toPromise();
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
    this.sankeySelection.transition().call(
      this.zoom.translateTo,
      // x
      (_x1 + _x0) / 2,
      // y
      (_y0 + _y1) / 2
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

  /**
   * Given the set of selected nodes and links, calculates the connected nodes/links and applies the `transitively-selected` attribute to
   * them.
   * @param entity current selection
   */
  calculateAndApplyTransitiveConnections(entity) {
    if (!entity) {
      this.nodeSelection
        .attr('transitively-selected', undefined);
      this.linkSelection
        .attr('transitively-selected', undefined);
    } else {
      this.assignAttrToRelativeLinksAndNodes(entity, 'transitively-selected');
    }
  }

  getConnectedNodesAndLinks(data: SankeyEntity) {
    const traversalId = data._id;
    const leftNode = ((data as SankeyLink)._source ?? data) as SankeyNode;
    const rightNode = ((data as SankeyLink)._target ?? data) as SankeyNode;

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

    return this.sankey.baseView.highlightCircular$.pipe(
      map(highlightCircular => {

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
  }

  assignAttrToRelativeLinksAndNodes(data, attr) {
    return this.getConnectedNodesAndLinks(data).pipe(
      tap(({nodesIds, linksIds}) => {
        this.assignAttrAndRaise(
          this.linkSelection,
          attr,
          (l) => {
            const has = linksIds.has(l._id);
            if (has && l._graphRelativePosition) {
              return l._graphRelativePosition;
            } else {
              return has;
            }
          }
        );
        this.assignAttrAndRaise(
          this.nodeSelection,
          attr,
          ({_id}) => nodesIds.has(_id)
        );
      })
    ).toPromise();
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
