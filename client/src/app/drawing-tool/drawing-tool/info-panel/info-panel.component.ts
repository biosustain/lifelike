import { Component, EventEmitter, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';

import * as $ from 'jquery';

import { DataFlowService } from '../../services';
import { GraphEntity, GraphEntityType, LaunchApp, UniversalGraphEdge, UniversalGraphNode } from '../../services/interfaces';

import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { annotationTypes } from 'app/shared/annotation-styles';
import { GraphEntityUpdate } from '../../../graph-viewer/actions/graph';
import { NodeDeletion } from '../../../graph-viewer/actions/nodes';

function emptyIfNull(s: any) {
  if (s == null) {
    return '';
  } else {
    return '' + s;
  }
}

function nullIfEmpty(s: any) {
  if (!s.length) {
    return null;
  } else {
    return s;
  }
}

// TODO: Move this somewhere better
type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};

@Component({
  selector: 'app-info-panel',
  templateUrl: './info-panel.component.html',
  styleUrls: ['./info-panel.component.scss']
})
export class InfoPanelComponent implements OnInit, OnDestroy {
  @ViewChild('autosize', {static: true}) autosize: CdkTextareaAutosize;
  @Output() openApp: EventEmitter<LaunchApp> = new EventEmitter<LaunchApp>();

  nodeTemplates = annotationTypes;

  paletteMode = 'minimized';

  entityForm = new FormGroup({
    display_name: new FormControl(),
    label: new FormControl(),
    hyperlink: new FormControl(),
    detail: new FormControl(),
    fontSizeScale: new FormControl(),
    fillColor: new FormControl(),
    strokeColor: new FormControl(),
    lineType: new FormControl(),
    lineWidthScale: new FormControl(),
    sourceEndType: new FormControl(),
    targetEndType: new FormControl(),
  }, {
    updateOn: 'blur'
  });

  selected: GraphEntity | undefined;

  pauseForm = false;

  graphDataSubscription: Subscription = null;
  formSubscription: Subscription = null;

  constructor(
    private dataFlow: DataFlowService
  ) {
  }

  ngOnInit() {
    // Handle data received from the graph
    this.graphDataSubscription = this.dataFlow.graphEntitySource.subscribe((selected: GraphEntity) => {
      this.selected = selected;

      if (selected) {
        if (selected.type === GraphEntityType.Node) {
          const node = selected.entity as UniversalGraphNode;
          const style = node.style || {};
          this.entityForm.setValue({
            display_name: emptyIfNull(node.display_name),
            label: node.label,
            hyperlink: emptyIfNull(node.data.hyperlink),
            detail: emptyIfNull(node.data.detail),
            fontSizeScale: emptyIfNull(style.fontSizeScale),
            fillColor: emptyIfNull(style.fillColor),
            strokeColor: emptyIfNull(style.strokeColor),
            lineType: emptyIfNull(style.lineType),
            lineWidthScale: emptyIfNull(style.lineWidthScale),
            sourceEndType: '',
            targetEndType: '',
          }, {emitEvent: false});
        } else if (selected.type === GraphEntityType.Edge) {
          const edge = selected.entity as UniversalGraphEdge;
          const style = edge.style || {};
          this.entityForm.setValue({
            display_name: edge.label,
            label: '',
            hyperlink: '',
            detail: '',
            fontSizeScale: emptyIfNull(style.fontSizeScale),
            fillColor: '',
            strokeColor: emptyIfNull(style.strokeColor),
            lineType: emptyIfNull(style.lineType),
            lineWidthScale: emptyIfNull(style.lineWidthScale),
            sourceEndType: emptyIfNull(style.sourceEndType),
            targetEndType: emptyIfNull(style.targetEndType),
          }, {emitEvent: false});
        }
      }

      if (this.paletteMode === 'minimized') {
        this.applyComponentSize();
      }
    });

    // Handle data received from the form
    this.formSubscription = this.entityForm.valueChanges
      .pipe(filter(() => !this.pauseForm))
      .subscribe((value) => {
          if (this.isSelectionNode()) {
            const data: RecursivePartial<UniversalGraphNode> = {
              display_name: value.display_name,
              label: value.label,
              data: {
                hyperlink: value.hyperlink,
                detail: value.detail
              },
              style: {
                fontSizeScale: nullIfEmpty(value.fontSizeScale),
                fillColor: nullIfEmpty(value.fillColor),
                strokeColor: nullIfEmpty(value.strokeColor),
                lineType: nullIfEmpty(value.lineType),
                lineWidthScale: nullIfEmpty(value.lineWidthScale),
              }
            };
            this.dataFlow.pushFormChange(
              new GraphEntityUpdate('Update node properties', this.selected, data)
            );
          } else if (this.isSelectionEdge()) {
            const data: RecursivePartial<UniversalGraphEdge> = {
              label: value.display_name,
              style: {
                fontSizeScale: nullIfEmpty(value.fontSizeScale),
                strokeColor: nullIfEmpty(value.strokeColor),
                lineType: nullIfEmpty(value.lineType),
                lineWidthScale: nullIfEmpty(value.lineWidthScale),
                sourceEndType: nullIfEmpty(value.sourceEndType),
                targetEndType: nullIfEmpty(value.targetEndType),
              }
            };
            this.dataFlow.pushFormChange(
              new GraphEntityUpdate('Update edge properties', this.selected, data)
            );
          } else {
            throw new Error('trying to edit something that the code doesn\'t know about is ill-advised');
          }
        }
      );
  }

  ngOnDestroy() {
    this.graphDataSubscription.unsubscribe();
    this.formSubscription.unsubscribe();
  }

  /**
   * Return whether the current selection is a node.
   */
  isSelectionNode(): boolean {
    return this.selected != null && this.selected.type === GraphEntityType.Node;
  }

  /**
   * Return whether the current selection is an edge.
   */
  isSelectionEdge(): boolean {
    return this.selected != null && this.selected.type === GraphEntityType.Edge;
  }

  /**
   * Show ourselves if we have something selected.
   */
  applyComponentSize() {
    if (this.selected) {
      $('#info-panel').addClass('in');
    } else {
      $('#info-panel').removeClass('in');
    }
  }

  /**
   * Delete the current node.
   */
  delete(): void {
    if (this.selected.type === GraphEntityType.Node) {
      const node = this.selected.entity as UniversalGraphNode;
      this.dataFlow.pushFormChange(new NodeDeletion('Delete node', node));
    }
  }

  /**
   * Allow user to navigate to a link in a new tab
   */
  goToLink(url = null) {
    const hyperlink: string = url || this.entityForm.value.hyperlink;

    if (!hyperlink) {
      return;
    }

    if (
      hyperlink.includes('http')
    ) {
      window.open(hyperlink, '_blank');
    } else if (
      hyperlink.includes('mailto')
    ) {
      window.open(hyperlink);
    } else {
      window.open('http://' + hyperlink);
    }
  }

  /**
   * Bring user to original source of node information
   */
  goToSource(): void {
    if (this.selected.type === GraphEntityType.Node) {
      const node = this.selected.entity as UniversalGraphNode;

      if (node.data.source.includes('/dt/pdf')) {
        const prefixLink = '/dt/pdf/';
        const [
          fileId,
          page,
          coordA,
          coordB,
          coordC,
          coordD
        ] = node.data.source.replace(prefixLink, '').split('/');
        // Emit app command with annotation payload
        this.openApp.emit({
            app: 'pdf-viewer',
            arg: {
              // tslint:disable-next-line: radix
              pageNumber: parseInt(page),
              fileId,
              coords: [
                parseFloat(coordA),
                parseFloat(coordB),
                parseFloat(coordC),
                parseFloat(coordD)
              ]
            }
          }
        );
      } else if (node.data.source.includes('/dt/map')) {
        const hyperlink = window.location.origin + node.data.source;
        window.open(hyperlink, '_blank');
      }
    }
  }

  blurInput(e: Event) {
    (e.target as HTMLElement).blur();
  }
}
