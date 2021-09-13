import { AfterViewInit, Component, OnDestroy, ViewEncapsulation, SimpleChanges, OnChanges } from '@angular/core';

import * as d3 from 'd3';
import { ClipboardService } from 'app/shared/services/clipboard.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SankeyComponent } from '../sankey/sankey.component';
import { SankeyLayoutService } from '../sankey/sankey-layout.service';
import * as aligns from '../sankey/aligin';
import { SankeyNode } from '../interfaces';


@Component({
  selector: 'app-sankey-many-to-many',
  templateUrl: '../sankey/sankey.component.html',
  styleUrls: ['../sankey/sankey.component.scss', './sankey-many-to-many.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class SankeyManyToManyComponent extends SankeyComponent implements AfterViewInit, OnDestroy, OnChanges {
  constructor(
    readonly clipboard: ClipboardService,
    readonly snackBar: MatSnackBar,
    readonly sankey: SankeyLayoutService
  ) {
    super(clipboard, snackBar, sankey);
  }

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

  // region Events
  async pathMouseOver(element, data) {
    this.highlightTraces(new Set([data._trace]));
  }

  async pathMouseOut(element, _data) {
    this.unhighlightTraces();
  }

  async nodeMouseOver(element, data) {
    const {highlightCircular} = this;
    this.highlightNode(element);

    const objects2traverse = new Set([
      {
        direction: 'left',
        node: data
      },
      {
        direction: 'right',
        node: data
      }
    ]);
    const helper = {
      left: {
        color: 'blue',
        nextNode: '_source',
        nextLinks: '_targetLinks',
        traversedLinks: new Set()
      },
      right: {
        color: 'green',
        nextNode: '_target',
        nextLinks: '_sourceLinks',
        traversedLinks: new Set()
      }
    };
    const nodes = new Set();

    for (const {direction, node} of objects2traverse) {
      const {
        color, nextNode, nextLinks, traversedLinks
      } = helper[direction];
      node[nextLinks].forEach(l => {
        const had = traversedLinks.has(l.id);
        if (!had && (highlightCircular || !l._circular)) {
          traversedLinks.add(l.id);
          l._highlightColor = l._visited === data.id ? 'teal' : color;
          l._visited = data.id;
          nodes.add(l[nextNode].id);
          objects2traverse.add({
            direction,
            node: l[nextNode]
          });
        }
      });
    }

    // function highlightLinks(data) {
    //   highlightTLinks(data);
    //   highlightSLinks(data);
    // }
    //
    // function highlightTLinks(data) {
    //   [...data._targetLinks].forEach(l => {
    //     const had = linksT.has(l.id);
    //     if (!had && (highlightCircular || !l._circular)) {
    //       linksT.add(l.id);
    //       l._highlightColor = 'blue';
    //       nodes.add(l._source.id);
    //       highlightTLinks(l._source);
    //     }
    //   });
    // }
    //
    // function highlightSLinks(data) {
    //   [...data._sourceLinks].forEach(l => {
    //     const had = linksS.has(l.id);
    //     if (!had && (highlightCircular || !l._circular)) {
    //       linksS.add(l.id);
    //       l._highlightColor = 'green';
    //       nodes.add(l._target.id);
    //       highlightSLinks(l._target);
    //     }
    //   });
    // }
    //
    // highlightLinks(data);
    const links = new Set([...helper.left.traversedLinks, ...helper.right.traversedLinks]);

    // this.linkSelection
    //   .style('stroke', l => links.has(l.id) && 'blue')
    //   .style('stroke-width', l => links.has(l.id) && 3);
    this.assignAttrAndRaise(this.linkSelection, 'highlighted', (l) => {
      l._visited = false;
      return links.has(l.id);
    })
      .style('stroke', ({_highlightColor}) => _highlightColor)
      .style('fill', ({_highlightColor}) => _highlightColor);
    this.assignAttrAndRaise(this.nodeSelection, 'highlighted', (n) => nodes.has(n.id))
      .style('fill', 'black');
    // this.linkSelection
    //   .style('stroke', l => links.has(l.id) && 'pink');
    // const nodeGroup = SankeyComponent.nodeGroupAccessor(data);
    // this.highlightNodeGroup(nodeGroup);
    // const traces = new Set([].concat(data._sourceLinks, data._targetLinks).map(link => link._trace));
    // this.highlightTraces(traces);
  }

  async nodeMouseOut(element, _data) {
    this.unhighlightNode(element);
    this.unhighlightTraces();
  }

  // endregion

  // region Select
  selectTraces(selection) {
    const selectedTraces = this.getSelectedTraces(selection);
    this.assignAttrAndRaise(this.linkSelection, 'selectedTrace', ({_trace}) => selectedTraces.has(_trace));
  }

  selectNodes(nodes: Set<SankeyNode>) {
    const traces = [];


    function highlightTLinks(data, linkss) {
      const foundings = [...data._targetLinks].reduce((o, l) => {
        const had = linkss.indexOf(l) > -1;
        if (!had && !l._circular) {
          const founds = highlightTLinks(l._source, linkss.concat([l]));
          founds.forEach(f => f.links.push(l.id));
          return o.concat(founds);
        }
        return o;
      }, []);
      if (nodes.has(data)) {
        foundings.forEach(f => {
          f.founds.add(data);
          if (f.founds.size === nodes.size) {
            traces.push(f);
          }
        });
        if (!foundings.length) {
          return [
            {
              founds: new Set([data]),
              links: []
            }
          ];
        }
      }
      return foundings;
    }

    if (nodes.size > 1) {
      const nodeFurthestRight = [...nodes].sort((a, b) => b._layer - a._layer)[0];
      highlightTLinks(nodeFurthestRight, []);
    }

    const links = new Set(traces.reduce((o, n) => o.concat(n.links), []));
    // tslint:disable-next-line:no-unused-expression
    this.nodeSelection
      .attr('selected', n => nodes.has(n));
    // tslint:disable-next-line:no-unused-expression
    this.linkSelection
      .attr('selected', n => links.has(n.id));
  }


  deselectNodes() {
    this.nodeSelection
      .attr('selected', undefined);
    this.deselectLinks();
  }

  deselectLinks() {
    this.linkSelection
      .attr('selected', undefined);
  }

  getSelectedTraces(selection) {
    const {links = this.selectedLinks, nodes = this.selectedNodes} = selection;
    const nodesLinks = [...nodes].reduce(
      (linksAccumulator, {_sourceLinks, _targetLinks}) =>
        linksAccumulator.concat(_sourceLinks, _targetLinks)
      , []
    );
    return new Set(nodesLinks.concat([...links]).map(link => link._trace)) as Set<object>;
  }

  selectLinks(links: Set<object>) {
    // tslint:disable-next-line:no-unused-expression
    this.linkSelection
      .attr('selected', l => links.has(l));
  }

  // endregion

  // region Highlight
  highlightTraces(traces: Set<object>) {
    this.assignAttrAndRaise(this.linkSelection, 'highlighted', ({_trace}) => traces.has(_trace));
  }

  unhighlightTraces() {
    this.linkSelection
      .attr('highlighted', undefined)
      .attr('style', undefined);
  }

  highlightNodeGroup(group) {
    this.nodeSelection
      .attr('highlighted', node => SankeyComponent.nodeGroupAccessor(node) === group);
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
        .each(SankeyComponent.updateTextShadow)
    );
  }

  unhighlightNode(element) {
    const {sankey: {nodeLabelShort, nodeLabelShouldBeShorted}, searchedEntities} = this;

    this.nodeSelection
      .attr('highlighted', false);

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
          .each(SankeyComponent.updateTextShadow)
      );
    }
  }

  // endregion
}
