import { AfterViewInit, Component, OnDestroy, ViewEncapsulation, ElementRef, NgZone } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { select as d3_select } from 'd3-selection';
import { isNil } from 'lodash-es';
import { zoom as d3_zoom } from 'd3-zoom';
import { filter, startWith, pairwise } from 'rxjs/operators';

import { SankeyNode, SankeyLink } from 'app/sankey/interfaces';
import { uuidv4 } from 'app/shared/utils';
import { ClipboardService } from 'app/shared/services/clipboard.service';

import { SankeySingleLaneLink } from '../../interfaces';
import { SankeyComponent } from '../../../../components/sankey/sankey.component';
import { SankeySelectionService } from '../../../../services/selection.service';
import { SankeySearchService } from '../../../../services/search.service';
import { SingleLaneLayoutService } from '../../services/single-lane-layout.service';
import { EntityType } from '../../../../services/search-match';


@Component({
  selector: 'app-sankey-single-lane',
  templateUrl: './sankey.component.svg',
  styleUrls: ['./sankey.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class SankeySingleLaneComponent extends SankeyComponent implements AfterViewInit, OnDestroy {
  constructor(
    readonly clipboard: ClipboardService,
    readonly snackBar: MatSnackBar,
    readonly sankey: SingleLaneLayoutService,
    readonly wrapper: ElementRef,
    protected zone: NgZone,
    protected selection: SankeySelectionService,
    protected search: SankeySearchService
  ) {
    super(
      clipboard,
      snackBar,
      sankey,
      wrapper,
      zone,
      selection,
      search
    );
    this.linkClick = this.linkClick.bind(this);
    this.nodeClick = this.nodeClick.bind(this);
    this.nodeMouseOver = this.nodeMouseOver.bind(this);
    this.pathMouseOver = this.pathMouseOver.bind(this);
    this.nodeMouseOut = this.nodeMouseOut.bind(this);
    this.pathMouseOut = this.pathMouseOut.bind(this);
    this.dragmove = this.dragmove.bind(this);
    this.attachLinkEvents = this.attachLinkEvents.bind(this);
    this.attachNodeEvents = this.attachNodeEvents.bind(this);

    this.zoom = d3_zoom()
      .scaleExtent([0.1, 8]);

    sankey.dataToRender$.subscribe(data => {
      this.updateDOM(data);
    });

    selection.selectedNodes$.subscribe(([node]) => {
      this.deselectLinks();
      this.selectNode(node);
      this.calculateAndApplyTransitiveConnections(node);
    });

    selection.selectedLinks$.subscribe(([link]) => {
      this.deselectNodes();
      this.selectLink(link);
      this.calculateAndApplyTransitiveConnections(link);
    });

    selection.selection$.pipe(
      filter(isNil)
    ).subscribe(() => {
      this.deselectNodes();
      this.deselectLinks();
      this.calculateAndApplyTransitiveConnections(null);
    });

    search.preprocessedMatches$.subscribe(entities => {
      if (entities.length) {
        this.searchNodes(new Set(entities.filter(({type}) => EntityType.Node).map(({id}) => id)));
        this.searchLinks(new Set(entities.filter(({type}) => EntityType.Link).map(({id}) => id)));
      } else {
        this.stopSearchNodes();
        this.stopSearchLinks();
      }
    });

    this.focusedEntity$.pipe(
      startWith(null),
      pairwise()
    ).subscribe(([currentValue, previousValue]) => {
      if (previousValue) {
        this.applyEntity(
          {
            nodeId: previousValue._id,
            linkId: previousValue._id
          },
          this.unFocusNode,
          this.unFocusLink
        );
      }
      if (currentValue) {
        this.applyEntity(
          {
            nodeId: previousValue._id,
            linkId: previousValue._id
          },
          this.focusNode,
          this.focusLink
        );
        this.panToEntity(currentValue);
      }
    });


  }

  highlightCircular$ = this.sankey.baseView.highlightCircular$;
  highlightCircular;

  applyEntity({nodeId, linkId}, nodeCallback, linkCallback) {
    if (nodeId) {
      nodeCallback.call(this, nodeId);
    }
    if (linkId) {
      linkCallback.call(this, linkId);
    }
  }

  // endregion

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

  deselectNodes() {
    this.nodeSelection
      .attr('selected', undefined);
  }

  deselectLinks() {
    this.linkSelection
      .attr('selected', undefined);
  }

  async pathMouseOver(element, data) {
    this.highlightLink(element);
  }

  async pathMouseOut(_element, _data) {
    this.unhighlightNodes();
    this.unhighlightLinks();
  }

  getConnectedNodesAndLinks(data: SankeyNode | SankeyLink) {
    const traversalId = (data as SankeyNode)._id ?? uuidv4();
    const leftNode = (data as SankeyLink)._source ?? data;
    const rightNode = (data as SankeyLink)._target ?? data;
    const {highlightCircular} = this;
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

    const links = new Set([...helper.left.traversedLinks, ...helper.right.traversedLinks]);

    links.forEach(l => delete l._visited);
    delete (data as SankeySingleLaneLink)._graphRelativePosition;
    links.add((data as SankeySingleLaneLink));

    return {nodes, links};
  }

  assignAttrToRelativeLinksAndNodes(data, attr) {
    const {nodes, links} = this.getConnectedNodesAndLinks(data);
    this.assignAttrAndRaise(
      this.linkSelection,
      attr,
      (l) => {
        const has = links.has(l);
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
      (n) => nodes.has(n)
    );
  }

  async nodeMouseOver(element, data) {
    this.highlightNode(element);
  }

  async nodeMouseOut(element, _data) {
    this.unhighlightNode(element);
    this.unhighlightNodes();
    this.unhighlightLinks();
  }

  // region Select

  selectNode(selectedNode) {
    this.assignAttrAndRaise(this.nodeSelection, 'selected', n => n === selectedNode);
  }

  selectLink(selectedLink) {
    this.assignAttrAndRaise(this.linkSelection, 'selected', n => n === selectedLink);
  }

  // endregion

  // region Highlight
  highlightLink(element) {
    d3_select(element)
      .raise()
      .attr('highlighted', true);
  }

  unhighlightLinks() {
    this.linkSelection
      .attr('highlighted', null);
  }

  highlightNode(element) {
    const {
      nodeLabelShort, nodeLabelShouldBeShorted, nodeLabel
    } = this.sankey;
    const selection = d3_select(element)
      .raise()
      .attr('highlighted', true)
      .select('g')
      .call(textGroup => {
        textGroup
          .select('text')
          .text(nodeLabelShort)
          .filter(nodeLabelShouldBeShorted)
          // todo: reenable when performance improves
          // .transition().duration(RELAYOUT_DURATION)
          // .textTween(n => {
          //   const label = nodeLabelAccessor(n);
          //   const length = label.length;
          //   const interpolator = d3Interpolate.interpolateRound(INITIALLY_SHOWN_CHARS, length);
          //   return t => t === 1 ? label :
          //     (label.slice(0, interpolator(t)) + '...').slice(0, length);
          // })
          .text(nodeLabel);
      });
    // postpone so the size is known
    requestAnimationFrame(_ =>
      selection
        .each(SankeySingleLaneComponent.updateTextShadow)
    );
  }

  unhighlightNodes() {
    this.nodeSelection
      .attr('highlighted', null);
  }

  unhighlightNode(element) {
    const {sankey: {nodeLabelShort, nodeLabelShouldBeShorted}, searchedEntities} = this;

    const selection = d3_select(element);
    selection.select('text')
      .filter(nodeLabelShouldBeShorted)
      // todo: reenable when performance improves
      // .transition().duration(RELAYOUT_DURATION)
      // .textTween(n => {
      //   const label = nodeLabelAccessor(n);
      //   const length = label.length;
      //   const interpolator = d3Interpolate.interpolateRound(length, INITIALLY_SHOWN_CHARS);
      //   return t => (label.slice(0, interpolator(t)) + '...').slice(0, length);
      // });
      .text(nodeLabelShort);

    // resize shadow back to shorter test when it is used as search result
    if (searchedEntities.length) {
      // postpone so the size is known
      requestAnimationFrame(_ =>
        selection.select('g')
          .each(SankeySingleLaneComponent.updateTextShadow)
      );
    }
  }

  // endregion
}
