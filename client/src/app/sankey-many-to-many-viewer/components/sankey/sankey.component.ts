import { AfterViewInit, Component, OnDestroy, ViewEncapsulation, SimpleChanges, OnChanges, Input } from '@angular/core';

import * as d3 from 'd3';
import { SankeyNode, SankeyLink } from '../../../sankey-viewer/components/interfaces';
import * as aligns from '../../../sankey-viewer/components/sankey/aligin';
import { SankeyComponent } from '../../../sankey-viewer/components/sankey/sankey.component';
import { uuidv4 } from '../../../shared/utils';
import { SankeyManyToManyLink } from '../interfaces';


@Component({
  selector: 'app-sankey-many-to-many',
  templateUrl: './sankey.component.html',
  styleUrls: [
    '../../../sankey-many-to-many-viewer/components/sankey/sankey.component.scss',
    './sankey.component.scss'
  ],
  encapsulation: ViewEncapsulation.None,
})
export class SankeyManyToManyComponent extends SankeyComponent implements AfterViewInit, OnDestroy, OnChanges {
  @Input() highlightCircular;

  // region Life cycle
  ngOnChanges({selectedNodes, selectedLinks, searchedEntities, focusedNode, data, nodeAlign}: SimpleChanges) {
    // using on Changes in place of setters as order is important
    if (nodeAlign) {
      const align = nodeAlign.currentValue;
      if (typeof align === 'function') {
        this.sankey.align = align;
      } else if (align) {
        this.sankey.align = aligns[align];
      }
    }
    if (data && this.svg) {
      // using this.data instead of current value so we use copy made by setter
      this.updateLayout(this.data).then(d => this.updateDOM(d));
    }
    if (selectedLinks) {
      const links = selectedLinks.currentValue;
      if (links.size) {
        this.selectLinks(links);
      } else {
        this.deselectLinks();
      }
    }
    if (selectedNodes) {
      const nodes = selectedNodes.currentValue;
      if (nodes.size) {
        this.selectNodes(nodes);
      } else {
        this.deselectNodes();
      }
    }
    if (searchedEntities) {
      const entities = searchedEntities.currentValue;
      if (entities.size) {
        this.searchNodes(entities);
        this.searchLinks(entities);
      } else {
        this.stopSearchNodes();
        this.stopSearchLinks();
      }
    }
    if (focusedNode) {
      const {currentValue, previousValue} = focusedNode;
      if (previousValue) {
        this.unFocusNode(previousValue);
        this.unFocusLink(previousValue);
      }
      if (currentValue) {
        this.focusNode(currentValue);
        this.focusLink(currentValue);
      }
    }
  }

  // endregion

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
    this.assignAttrToRelativeLinksAndNodes(data, 'highlighted');
  }

  async pathMouseOut(_element, _data) {
    this.unhighlightNodes();
    this.unhighlightLinks();
  }

  getConnectedNodesAndLinks(data: SankeyNode | SankeyLink) {
    const traversalId = (data as SankeyNode).id || uuidv4();
    const leftNode = (data as SankeyLink)._source || data;
    const rightNode = (data as SankeyLink)._target || data;
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
        traversedLinks: new Set<SankeyManyToManyLink>()
      },
      right: {
        graphRelativePosition: 'right',
        nextNode: '_target',
        nextLinks: '_sourceLinks',
        traversedLinks: new Set<SankeyManyToManyLink>()
      }
    };
    const nodes = new Set([leftNode, rightNode]);

    for (const {direction, node} of objects2traverse) {
      const {
        graphRelativePosition, nextNode, nextLinks, traversedLinks
      } = helper[direction];
      node[nextLinks].forEach((l: SankeyManyToManyLink) => {
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
    delete (data as SankeyManyToManyLink)._graphRelativePosition;
    links.add((data as SankeyManyToManyLink));

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
    this.assignAttrToRelativeLinksAndNodes(data, 'highlighted');
  }

  async nodeMouseOut(element, _data) {
    this.unhighlightNode(element);
    this.unhighlightNodes();
    this.unhighlightLinks();
  }

  // region Select

  selectNodes(selectedNodes: Set<SankeyNode>) {
    const data = selectedNodes.values().next().value;
    this.assignAttrToRelativeLinksAndNodes(data, 'selected');
  }

  selectLinks(selectedLinks: Set<object>) {
    const data = selectedLinks.values().next().value;
    this.assignAttrToRelativeLinksAndNodes(data, 'selected');
  }

  // endregion

  // region Highlight
  highlightLink(element) {
    d3.select(element)
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
    const selection = d3.select(element)
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
        .each(SankeyManyToManyComponent.updateTextShadow)
    );
  }

  unhighlightNodes() {
    this.nodeSelection
      .attr('highlighted', null);
  }

  unhighlightNode(element) {
    const {sankey: {nodeLabelShort, nodeLabelShouldBeShorted}, searchedEntities} = this;

    const selection = d3.select(element);
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

    // resize shadow back to shorter test when it is ussed as search result
    if (searchedEntities.size) {
      // postpone so the size is known
      requestAnimationFrame(_ =>
        selection.select('g')
          .each(SankeyManyToManyComponent.updateTextShadow)
      );
    }
  }

  // endregion

  updateDOM(graph) {
    const {
      sankey: {
        // @ts-ignore
        nodeGraphRelativePosition
      }
    } = this;
    super.updateDOM(graph);
    this.nodeSelection
      .attr('graphRelativePosition', nodeGraphRelativePosition);
  }
}
