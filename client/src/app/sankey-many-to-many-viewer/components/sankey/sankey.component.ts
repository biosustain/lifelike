import { AfterViewInit, Component, OnDestroy, ViewEncapsulation, SimpleChanges, OnChanges, Input } from '@angular/core';

import { select as d3_select } from 'd3-selection';
import { isNil, compact } from 'lodash-es';

import { SankeyNode, SankeyLink } from 'app/shared-sankey/interfaces';
import * as aligns from 'app/sankey-viewer/components/sankey/aligin';
import { SankeyComponent } from 'app/sankey-viewer/components/sankey/sankey.component';
import { uuidv4 } from 'app/shared/utils';

import { SankeyManyToManyLink, SankeyManyToManyNode } from '../interfaces';

const nodeSorter = (a, b) => {
  // sort by order given in tree traversal
  return (
    a._source._order - b._source._order ||
    a._target._order - b._target._order ||
    a._order - b._order
  );
};


@Component({
  selector: 'app-sankey-many-to-many',
  templateUrl: './sankey.component.svg',
  styleUrls: ['./sankey.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class SankeyManyToManyComponent extends SankeyComponent implements AfterViewInit, OnDestroy, OnChanges {
  @Input() highlightCircular;

  @Input() selected: undefined | SankeyManyToManyLink | SankeyManyToManyNode;

  // region Life cycle
  ngOnChanges({selected, searchedEntities, focusedNode, data, nodeAlign}: SimpleChanges) {
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
      this._data.links.sort((a: any, b: any) => a._index - b._index);
      data.previousValue.links.sort((a, b) => a._index - b._index);

      let m = 0;
      for (const link of data.previousValue.links) {
        this._data.links[m]._y0 = link._y0;
        this._data.links[m]._y1 = link._y1;
        this._data.links[m]._width = link._width;
        this._data.links[m]._value = link._value;
        this._data.links[m]._circular = link._circular;
        this._data.links[m]._index = link._index;
        this._data.links[m]._order = link._order;
        if (isNil(this._data.links[m]._order)) {
          this._data.links[m]._order = 0;
        }
        m++;
      }

      this._data.nodes.sort((a: any, b: any) => a._index - b._index);
      data.previousValue.nodes.sort((a, b) => a._index - b._index);

      for (let i = 0; i < data.previousValue.nodes.length; i++) {
        const prevNode = data.previousValue.nodes[i];
        const dataNode = this._data.nodes[i];

        dataNode._value = prevNode._value;
        dataNode._x0 = prevNode._x0;
        dataNode._x1 = prevNode._x1;
        dataNode._y0 = prevNode._y0;
        dataNode._y1 = prevNode._y1;
        if (isNil(prevNode._order)) {
          dataNode._order = 0;
        } else {
          dataNode._order = prevNode._order;
        }

        if (isNil(dataNode._sourceLinks)) {
          dataNode._sourceLinks = prevNode._sourceLinks.map((link) => this._data.links[link._index]);
        } else {
          for (let j = 0; j < prevNode._sourceLinks.length; j++) {
            dataNode._sourceLinks[j] = this._data.links[dataNode._sourceLinks[j]._index];
          }
        }

        if (isNil(dataNode._targetLinks)) {
          dataNode._targetLinks = prevNode._targetLinks.map((link) => this._data.links[link._index]);
        } else {
          for (let k = 0; k < prevNode._targetLinks.length; k++) {
            dataNode._targetLinks[k] = this._data.links[dataNode._targetLinks[k]._index];
          }
        }
      }

      /* tslint:disable:prefer-for-of */
      for (let n = 0; n < this.data.nodes.length; n++) {
        for (let i = 0; i < this.data.nodes[n]._sourceLinks.length; i++) {
          this.data.nodes[n]._sourceLinks[i]._source = this.data.nodes[n];
        }

        for (let j = 0; j < this.data.nodes[n]._targetLinks.length; j++) {
          this.data.nodes[n]._targetLinks[j]._target = this.data.nodes[n];
        }
      }


      /* tslint:disable:prefer-for-of */
      for (let n = 0; n < this.data.nodes.length; n++) {
        if (!isNil(this.data.nodes[n]._sourceLinks)) {
          try {
            this.data.nodes[n]._sourceLinks.sort(nodeSorter);
          } catch {
            console.log(this.data.nodes[n]);
          }
        }
        if (!isNil(this.data.nodes[n]._targetLinks)) {
          this.data.nodes[n]._targetLinks.sort(nodeSorter);
        }
      }


      // using this.data instead of current value so we use copy made by setter
      this.updateLayout(this.data).then(d => this.updateDOM(d));
    }

    if (selected) {
      if (isNil(selected.currentValue)) {
        this.deselectNodes();
        this.deselectLinks();
        this.calculateAndApplyTransitiveConnections(null);
      } else {
        const {node, link} = selected.currentValue;
        if (node) {
          this.deselectLinks();
          this.selectNode(node);
          this.calculateAndApplyTransitiveConnections(node);
        }
        if (link) {
          this.deselectNodes();
          this.selectLink(link);
          this.calculateAndApplyTransitiveConnections(link);
        }
      }
    }

    if (searchedEntities) {
      const entities = searchedEntities.currentValue;
      if (entities.length) {
        this.searchNodes(
          new Set(
            compact(entities.map(({nodeId}) => nodeId))
          )
        );
        this.searchLinks(
          new Set(
            compact(entities.map(({linkId}) => linkId))
          )
        );
      } else {
        this.stopSearchNodes();
        this.stopSearchLinks();
      }
    }
    if (focusedNode) {
      const {currentValue, previousValue} = focusedNode;
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
      }
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
        .each(SankeyManyToManyComponent.updateTextShadow)
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
          .each(SankeyManyToManyComponent.updateTextShadow)
      );
    }
  }

  // endregion
}
