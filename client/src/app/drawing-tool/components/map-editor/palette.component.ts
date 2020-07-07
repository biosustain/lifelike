import {Component} from '@angular/core';

import {AnnotationStyle, annotationTypes} from 'app/shared/annotation-styles';
import {NODE_TYPE_ID, UniversalGraphNode} from '../../services/interfaces';

@Component({
  selector: 'app-palette',
  templateUrl: './palette.component.html',
  styleUrls: ['./palette.component.scss']
})
export class PaletteComponent {
  nodeTemplates = annotationTypes;
  expanded = false;

  constructor() {
  }

  /**
   * Get the node templates that we plan to show, based on whether
   * we have this baby expanded.
   */
  get nodeTemplatesShown() {
    if (this.expanded) {
      return this.nodeTemplates;
    } else {
      return this.nodeTemplates.slice(0, 8);
    }
  }

  toggleExpansion() {
    this.expanded = !this.expanded;
  }

  dragStarted(event: DragEvent, annotationStyle: AnnotationStyle) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    dataTransfer.setData('text/plain', annotationStyle.label);
    dataTransfer.setData('application/lifelike-node', JSON.stringify({
      display_name: annotationStyle.label,
      label: annotationStyle.label,
      sub_labels: [],
    } as Partial<UniversalGraphNode>));
  }
}
