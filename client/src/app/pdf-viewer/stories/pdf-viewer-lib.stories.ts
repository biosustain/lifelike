import { CommonModule } from '@angular/common';
import {moduleMetadata, Story} from '@storybook/angular';
import { PdfViewerLibComponent } from '../pdf-viewer-lib.component';// This exports the Stories group for this component
export default {
  // The title defines the name and where in the structure of
  // Storybook's menu this is going to be placed.
  // Here we add it to a "Components" section under "Link"
  title: 'Components/PdfViewerLibComponent',  // The component related to the Stories
  component: PdfViewerLibComponent,  decorators: [
    // The necessary modules for the component to work on Storybook
    moduleMetadata({
      declarations: [PdfViewerLibComponent],
      imports: [CommonModule],
    }),
  ],
};// This creates a Story for the component
const Template: Story<PdfViewerLibComponent> = () => ({
  component: PdfViewerLibComponent,
  template: `<lib-pdf-viewer-lib
              id='pdf-viewer'
              appPdfViewer
              [pdfSrc]="pdfData"
              [annotations]="annotations"
              [goToPosition]="goToPosition"
              [highlightAnnotations]="highlightAnnotations"
              [addedAnnotations]="addedAnnotations"
              [removedAnnotationIds]="removedAnnotationIds"
              [addedAnnotationExclusion]="addedAnnotationExclusion"
              [entityTypeVisibilityMap]="entityTypeVisibilityMap"
              [filterChanges]="filterChangeSubject"
              [searchChanged]="searchChanged"
              [showExcludedAnnotations]="showExcludedAnnotations"
              [removedAnnotationExclusion]="removedAnnotationExclusion"
              (annotationDragStart)="addAnnotationDragData($event)"
              (annotation-exclusion-added)="annotationExclusionAdded($event)"
              (annotation-exclusion-removed)="annotationExclusionRemoved($event)"
              (custom-annotation-created)="annotationCreated($event)"
              (loadCompleted)="loadCompleted($event)"
              (custom-annotation-removed)="annotationRemoved($event)"
              (searchChange)="searchQueryChangedFromViewer($event)"
            >
            </lib-pdf-viewer-lib>`,
});
export const Base = Template.bind({});// Other stories could be added here as well, all you have to do is export them along!
