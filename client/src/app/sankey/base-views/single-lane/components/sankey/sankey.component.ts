import { AfterViewInit, Component, OnDestroy, ViewEncapsulation, ElementRef, NgZone } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { select as d3_select } from 'd3-selection';
import { startWith, pairwise, map, tap } from 'rxjs/operators';

import { SankeyNode, SankeyLink, SelectionType } from 'app/sankey/interfaces';
import { uuidv4, mapIterable } from 'app/shared/utils';
import { ClipboardService } from 'app/shared/services/clipboard.service';

import { SankeySingleLaneLink } from '../../interfaces';
import { SankeyAbstractComponent } from '../../../../abstract/sankey.component';
import { SingleLaneLayoutService } from '../../services/single-lane-layout.service';
import { SankeySelectionService } from '../../../../services/selection.service';
import { SankeySearchService } from '../../../../services/search.service';
import { EntityType } from '../../../../utils/search/search-match';

type SankeyEntity = SankeyNode | SankeyLink;

@Component({
  selector: 'app-sankey-single-lane',
  templateUrl: '../../../../abstract/sankey.component.svg',
  styleUrls: ['./sankey.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class SankeySingleLaneComponent extends SankeyAbstractComponent implements AfterViewInit, OnDestroy {
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
    this.initComopnent();
  }

  initFocus() {
    this.focusedEntity$.pipe(
      startWith(null),
      pairwise()
    ).subscribe(([currentValue, previousValue]) => {
      if (previousValue) {
        this.applyEntity(
          previousValue,
          this.unFocusNode,
          this.unFocusLink
        );
      }
      if (currentValue) {
        this.applyEntity(
          currentValue,
          this.focusNode,
          this.focusLink
        );
        this.panToEntity(currentValue);
      }
    });
  }

  initSelection() {
    this.selection.selection$.subscribe(([selectedEntity]) => {
      const {type, entity} = selectedEntity ?? {};
      switch (type) {
        case SelectionType.node:
          this.deselectLinks();
          this.selectNode(entity);
          break;
        case SelectionType.link:
          this.deselectNodes();
          this.selectLink(entity);
          break;
        default:
          this.deselectNodes();
          this.deselectLinks();
      }
      this.calculateAndApplyTransitiveConnections(entity);
    });
  }

  applyEntity({type, id}, nodeCallback, linkCallback) {
    switch (type) {
      case EntityType.Node:
        return nodeCallback(id);
      case EntityType.Link:
        return linkCallback(id);
    }
  }

  ngAfterViewInit() {
    super.ngAfterViewInit();
  }

  ngOnDestroy() {
    super.ngOnDestroy();
  }


  async pathMouseOver(element, data) {
    this.highlightLink(element);
  }

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

  async nodeMouseOut(element, _data) {
    this.unhighlightNode(element);
    this.unhighlightNodes();
    this.unhighlightLinks();
  }

  // region Select

  selectNode(selectedNode) {
    this.assignAttrAndRaise(this.nodeSelection, 'selected', ({_id}) => _id === selectedNode._id);
  }

  selectLink(selectedLink) {
    this.assignAttrAndRaise(this.linkSelection, 'selected', ({_id}) => _id === selectedLink._id);
  }

  // endregion

  // region Highlight
  highlightLink(element) {
    d3_select(element)
      .raise()
      .attr('highlighted', true);
  }


  highlightNode(element) {
    const { extendNodeLabel } = this;
    const selection = d3_select(element)
      .raise()
      .attr('highlighted', true)
      .select('g')
      .call(extendNodeLabel);
    // postpone so the size is known
    requestAnimationFrame(_ =>
      selection
        .each(SankeyAbstractComponent.updateTextShadow)
    );
  }

  // endregion
}
