import { Component, Inject, ViewEncapsulation } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Annotation } from '../annotation-type';
import { ENTITY_TYPE_MAP, ENTITY_TYPES } from '../../shared/annotation-types';

export interface DialogData {
  allText: string;
  text: string[];
  coords: any[];
  pageNumber: number;
}

@Component({
  selector: 'app-annotation-panel',
  templateUrl: './annotation-panel.component.html',
  styleUrls: ['./annotation-panel.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class AnnotationPanelComponent {
  entityType: string;
  links = {
    ncbi: '',
    uniprot: '',
    wikipedia: '',
    google: ''
  };

  get entityTypes() {
    return ENTITY_TYPES;
  }

  constructor(
    private dialogRef: MatDialogRef<AnnotationPanelComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) { }

  createAnnotation() {
    if (ENTITY_TYPE_MAP[this.entityType] === undefined) {
      throw new Error(`unknown entity type ${this.entityType}`);
    }
    const annotation: Annotation = {
      pageNumber: this.data.pageNumber,
      keywords: this.data.text,
      rects: this.data.coords.map((coord) => {
        return [coord[0], coord[3], coord[2], coord[1]];
      }),
      meta: {
        type: this.entityType,
        color: ENTITY_TYPE_MAP[this.entityType].color,
        links: this.links,
        isCustom: true,
        allText: this.data.allText,
        primaryLink: this.links.ncbi || this.links.uniprot || this.links.wikipedia || this.links.google
      }
    };
    this.dialogRef.close(annotation);
  }

}
