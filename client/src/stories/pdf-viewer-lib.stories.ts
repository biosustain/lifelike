import { CommonModule } from '@angular/common';
import {moduleMetadata, Story} from '@storybook/angular';
import { PdfViewerLibComponent } from 'app/pdf-viewer/pdf-viewer-lib.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import {PdfViewerLibModule} from "../app/pdf-viewer/pdf-viewer-lib.module";
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
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
      imports: [CommonModule, PdfViewerLibModule, NgbModule ],
      providers: [ MatSnackBar ]
    }),
  ]
};// This creates a Story for the component

console.log(PdfViewerLibComponent);
const Template: Story<PdfViewerLibComponent> = () => ({
  component: PdfViewerLibComponent,
  props: {
    // searchChanged: Subject<{ keyword: string, findPrevious: boolean }>,
    pdfSrc: 'https://ilearn.marist.edu/access/lessonbuilder/item/172134/group/e0d1b466-ea21-433b-8926-c41f19455217/Course%20Materials/SamplePDF.pdf',
    annotations: [],
    // goToPosition: Subject<Location>,
    // highlightAnnotations: Subject<string>,
    debugMode: true,
    entityTypeVisibilityMap: new Map(),
    // filterChanges: Observable<void>,
    currentHighlightAnnotationId: undefined
  },
  template: `<lib-pdf-viewer-lib
              appPdfViewer
              >
            </lib-pdf-viewer-lib>`,
});
export const Base = Template.bind({});// Other stories could be added here as well, all you have to do is export them along!
