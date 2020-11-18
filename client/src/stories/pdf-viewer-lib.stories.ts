import { CommonModule } from '@angular/common';
import {moduleMetadata, Story} from '@storybook/angular';
import { PdfViewerLibComponent } from 'app/pdf-viewer/pdf-viewer-lib.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { PdfViewerModule } from "../app/pdf-viewer/pdf-viewer/pdf-viewer.module";
import { SharedModule } from "../app/shared/shared.module";
import { FormsModule } from '@angular/forms';
import { FlexLayoutModule } from '@angular/flex-layout';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatChipsModule, MatDialogModule, MatInputModule, MatSelectModule } from '@angular/material';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { SharedNgrxEffects } from "../app/shared/store/effects";
import { EffectsModule } from '@ngrx/effects';
import {RootStoreModule} from "../app/root-store";
import { BehaviorSubject, combineLatest, Subject, Subscription } from 'rxjs';
import {
  AddedAnnotationExclusion,
  Annotation,
  Location,
  Meta,
  RemovedAnnotationExclusion,
} from '../app/pdf-viewer/annotation-type';

// This exports the Stories group for this component
export default {
  // The title defines the name and where in the structure of
  // Storybook's menu this is going to be placed.
  // Here we add it to a "Components" section under "Link"
  title: 'Components/PdfViewerLibComponent',  // The component related to the Stories
  component: PdfViewerLibComponent,  decorators: [
    // The necessary modules for the component to work on Storybook
    moduleMetadata({
      declarations: [
        PdfViewerLibComponent
      ],
      imports: [
        CommonModule,
        PdfViewerModule,
        FormsModule,
        BrowserAnimationsModule,
        MatFormFieldModule,
        MatCheckboxModule,
        MatSidenavModule,
        MatDialogModule,
        MatChipsModule,
        MatSelectModule,
        MatInputModule,
        FlexLayoutModule,
        MatButtonModule,
        MatRadioModule,
        RootStoreModule,
        SharedModule,
        NgbModule,
        EffectsModule.forRoot([SharedNgrxEffects]),
      ],
      providers: [
        MatSnackBar,
        SharedNgrxEffects
      ],
    }),
  ]
};// This creates a Story for the component

const Template: Story<PdfViewerLibComponent> = () => ({
  component: PdfViewerLibComponent,
  props: {
    // searchChanged: Subject<{ keyword: string, findPrevious: boolean }>,
    pdfSrc: './assets/pdfs/sample.pdf',
    annotations: [],
    goToPosition: new Subject<Location>(),
    highlightAnnotations: new Subject<string>(),
    debugMode: true,
    entityTypeVisibilityMap: new Map(),
    currentHighlightAnnotationId: undefined,
    searchChanged: new Subject<{ keyword: string, findPrevious: boolean }>()
  },
  template: `<lib-pdf-viewer-lib
              id='pdf-viewer'
              appPdfViewer
              [pdfSrc]="pdfSrc"
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
