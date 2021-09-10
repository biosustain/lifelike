import {
  AfterViewInit,
  Component,
  OnDestroy,
  ViewEncapsulation,
  SimpleChanges,
  OnChanges
} from '@angular/core';

import * as d3 from 'd3';
import { ClipboardService } from 'app/shared/services/clipboard.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SankeyComponent } from '../sankey/sankey.component';
import { SankeyLayoutService } from '../sankey/sankey-layout.service';


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
  ngOnChanges({selectedNodes, selectedLinks, searchedEntities, focusedNode, data, ...rest}: SimpleChanges) {
    super.ngOnChanges(rest);
    if (data && this.svg) {
      // using this.data instead of current value so we use copy made by setter
      this.updateLayout(this.data).then(d => this.updateDOM(d));
    }

    let nodes;
    let links;
    if (selectedNodes) {
      nodes = selectedNodes.currentValue;
      if (nodes.size) {
        this.selectNodes(nodes);
      } else {
        this.deselectNodes();
      }
    } else {
      nodes = this.selectedNodes;
    }
    if (selectedLinks) {
      links = selectedLinks.currentValue;
      if (links.size) {
        this.selectLinks(links);
      } else {
        this.deselectLinks();
      }
    } else {
      links = this.selectedLinks;
    }
    if (selectedNodes || selectedLinks) {
      this.selectTraces({links, nodes});
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

  getSelectedTraces(selection) {
    const {links = this.selectedLinks, nodes = this.selectedNodes} = selection;
    const nodesLinks = [...nodes].reduce(
      (linksAccumulator, {_sourceLinks, _targetLinks}) =>
        linksAccumulator.concat(_sourceLinks, _targetLinks)
      , []
    );
    return new Set(nodesLinks.concat([...links]).map(link => link._trace)) as Set<object>;
  }

  // region Events
  async pathMouseOver(element, data) {
    this.highlightTraces(new Set([data._trace]));
  }

  async pathMouseOut(element, _data) {
    this.unhighlightTraces();
  }

  async nodeMouseOver(element, data) {
    this.highlightNode(element);
    const nodeGroup = SankeyComponent.nodeGroupAccessor(data);
    this.highlightNodeGroup(nodeGroup);
    const traces = new Set([].concat(data._sourceLinks, data._targetLinks).map(link => link._trace));
    this.highlightTraces(traces);
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

  selectNodes(nodes: Set<object>) {
    // tslint:disable-next-line:no-unused-expression
    this.nodeSelection
      .attr('selected', n => nodes.has(n));
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
      .attr('highlighted', undefined);
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
