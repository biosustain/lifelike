import { NgModule } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { NgbAccordionModule, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';

import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserModule } from 'app/file-browser/file-browser.module';
import { ClipboardService } from 'app/shared/services/clipboard.service';
import { TruncatePipe } from 'app/shared/pipes/truncate.pipe';
import ControlsModule from 'app/shared/modules/controls';

import { SankeyViewComponent } from './components/sankey-view.component';
import { SankeyDirective } from './directives/sankey.directive';
import { SankeyDetailsPanelDirective } from './directives/details-panel.directive';
import { SankeySearchPanelModule } from './components/search-panel/sankey-search-panel.module';
import { PathReportComponent } from './components/path-report/path-report.component';
import { SankeyAdvancedPanelDirective } from './directives/advanced-panel.directive';
import { SankeyViewCreateComponent } from './components/view/create/view-create.component';
import { SankeyAdvancedPanelComponent } from './components/advanced-panel/advanced-panel.component';
import { SankeyConfirmComponent } from './components/confirm.component';
import { SankeySearchControlModule } from './components/search-control/sankey-search-control.module';
import { StructureOverviewComponent } from './components/structure-overview/structure-overview.component';
import { NetworktraceViewDropdownContentComponent } from './components/networktrace-view-dropdown-content';
import { ValidationReportComponent } from './components/validation-report/validation-report.component';
import { SearchableTreeComponent } from './components/form/searchable-tree/searchable-tree.component';
import { ConstrainToViewportDirective } from './directives/constrain-to-viewport.directive';
import { RotateDirective } from './directives/rotate.directive';

const exports = [SankeyViewComponent];

@NgModule({
  imports: [
    BrowserAnimationsModule,
    MatSnackBarModule,
    SharedModule,
    FileBrowserModule,
    SankeySearchPanelModule,
    SankeySearchControlModule,
    NgbDropdownModule,
    NgbAccordionModule,
    ControlsModule,
  ],
  declarations: [
    SankeyDirective,
    SankeyDetailsPanelDirective,
    SankeyAdvancedPanelDirective,
    PathReportComponent,
    ValidationReportComponent,
    SankeyConfirmComponent,
    SankeyViewCreateComponent,
    SankeyAdvancedPanelComponent,
    StructureOverviewComponent,
    NetworktraceViewDropdownContentComponent,
    SearchableTreeComponent,
    ConstrainToViewportDirective,
    RotateDirective,
    ...exports,
  ],
  providers: [TruncatePipe, ClipboardService],
  exports,
})
export class SankeyViewerLibModule {}
