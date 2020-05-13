import { Component, Inject, ViewEncapsulation } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Annotation } from '../annotation-type';

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
  // TODO: align colors for entities among all apps
  entityTypes = [
    { name: 'Genes', color: '#8f7cbf' },
    { name: 'Proteins', color: '#bcbd22' },
    { name: 'Diseases', color: '#fae0b8' },
    { name: 'Species', color: '#3177b8' },
    { name: 'Companies', color: '#ff7f7f' },
    { name: 'Mutations', color: '#8b5d2e' },
    { name: 'Chemicals', color: '#cee5cb' },
    { name: 'Phenotypes', color: '#edc949' },
    { name: 'Pathways', color: '#90eebf' },
    { name: 'Entities', color: '#7f7f7f' }
  ];

  constructor(
    private dialogRef: MatDialogRef<AnnotationPanelComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) { }

  createAnnotation() {
    const annotation: Annotation = {
      pageNumber: this.data.pageNumber,
      keywords: this.data.text,
      rects: this.data.coords.map((coord) => {
        return [coord[0], coord[3], coord[2], coord[1]];
      }),
      meta: {
        type: this.entityType,
        color: this.entityTypes.find(entity => entity.name === this.entityType).color,
        links: this.links,
        isCustom: true,
        allText: this.data.allText
      }
    };
    this.dialogRef.close(annotation);
  }

}
