import { Component, OnChanges } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { AnnotationStyle, annotationTypes } from 'app/shared/annotation-styles';

import { UniversalGraphNode, UniversalGraphNodeTemplate } from '../../services/interfaces';
import { createNodeDragImage } from '../../utils/drag';

@Component({
  selector: 'app-palette',
  templateUrl: './palette.component.html',
  styleUrls: ['./palette.component.scss'],
})
export class PaletteComponent {
  expanded = false;

  /**
   * Node templates that we plan to show, based on whether we have the palette expanded.
   */
  nodeTemplates: AnnotationStyle[] = annotationTypes.slice(0, 8);

  constructor(private readonly snackBar: MatSnackBar) {}

  toggleExpansion() {
    this.expanded = !this.expanded;

    if (this.expanded) {
      this.nodeTemplates = annotationTypes;
    } else {
      this.nodeTemplates = annotationTypes.slice(0, 8);
    }
  }

  dragStart(event: DragEvent, annotationStyle: AnnotationStyle) {
    const copiedNode: UniversalGraphNodeTemplate = {
      display_name: annotationStyle.label,
      label: annotationStyle.label,
      sub_labels: [],
    };

    const dragImageNode: UniversalGraphNode = {
      ...copiedNode,
      hash: '',
      data: {
        x: 0,
        y: 0,
      },
    };

    const dataTransfer: DataTransfer = event.dataTransfer;
    createNodeDragImage(dragImageNode).addDataTransferData(dataTransfer);
    dataTransfer.setData('text/plain', annotationStyle.label);
    dataTransfer.setData('application/***ARANGO_DB_NAME***-node', JSON.stringify(copiedNode));
  }

  click() {
    this.snackBar.open('Drag from the palette to the graph to create new nodes.', null, {
      duration: 3000,
    });
  }
}
