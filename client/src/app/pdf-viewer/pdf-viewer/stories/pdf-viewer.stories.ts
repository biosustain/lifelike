import {CommonModule} from '@angular/common';
import {moduleMetadata, Story} from '@storybook/angular';
import {PdfViewerLibComponent} from 'app/pdf-viewer/pdf-viewer-lib.component';
import {MatSnackBar} from '@angular/material/snack-bar';
import {NgbModule} from '@ng-bootstrap/ng-bootstrap';
import {FormsModule} from '@angular/forms';
import {FlexLayoutModule} from '@angular/flex-layout';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatSidenavModule} from '@angular/material/sidenav';
import {MatChipsModule, MatDialogModule, MatInputModule, MatSelectModule} from '@angular/material';
import {MatButtonModule} from '@angular/material/button';
import {MatRadioModule} from '@angular/material/radio';
import {EffectsModule} from '@ngrx/effects';
import {Subject} from 'rxjs';
import {PdfViewerComponent, RenderTextMode} from "../pdf-viewer.component";
import {select} from '@storybook/addon-knobs';
import { boolean, number, text, withKnobs } from '@storybook/addon-knobs';


// This exports the Stories group for this component
export default {
  // The title defines the name and where in the structure of
  // Storybook's menu this is going to be placed.
  // Here we add it to a "Components" section under "Link"
  title: 'PdfViewer/PdfViewerLibComponent/PdfViewerComponent',  // The component related to the Stories
  component: PdfViewerComponent, decorators: [
    withKnobs,
    // The necessary modules for the component to work on Storybook
    moduleMetadata({
      declarations: [
        PdfViewerComponent
      ],
      imports: [
        CommonModule
      ],
      providers: [],
    }),
  ]
};// This creates a Story for the component

const Template: Story<PdfViewerComponent> = (args) => ({
  component: PdfViewerComponent,
  props: args,
  template: `<app-pdf-viewer-lib [src]="pdfSrc" [(page)]="page" [rotation]="rotation" [original-size]="originalSize"
                        [fit-to-page]="fitToPage"
                        [show-borders]="debugMode"
                        (after-load-complete)="afterLoadComplete($event)" [zoom]="zoom" [show-all]="showAll"
                        [stick-to-page]="stickToPage"
                        [render-text]="renderText"
                        [render-text-mode]="renderTextMode"
                        [external-link-target]="'blank'" [autoresize]="autoresize"
                        (error)="onError($event)"
                        (on-progress)="onProgress($event)" (page-rendered)="pageRendered($event)"
                        (matches-count-updated)="matchesCountUpdated($event)"
                        (find-control-state-updated)="findControlStateUpdated($event)">
            </app-pdf-viewer-lib>`,
});

export const Base = Template.bind({}); // Other stories could be added here as well, all you have to do is export them along!
Base.args = {
  pdfSrc: './assets/pdfs/sample.pdf',
  showAll: true,
  zoom: 1,
  renderText: true,
  renderTextMode: 1
};

export const Enhanced = Template.bind({}); // Other stories could be added here as well, all you have to do is export them along!
Enhanced.args = {
  pdfSrc: './assets/pdfs/sample.pdf',
  showAll: true,
  zoom: 1,
  renderText: true,
  renderTextMode: 2
};
