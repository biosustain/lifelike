import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FlexLayoutModule } from '@angular/flex-layout';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { RouterModule } from '@angular/router';

import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserModule } from 'app/file-browser/file-browser.module';
import { ClipboardService } from 'app/shared/services/clipboard.service';

import { SankeyViewComponent } from './components/sankey-view.component';
import { SankeyDirective } from './directives/sankey.directive';
import { SankeyDetailsPanelDirective } from './directives/details-panel.directive';
import { SankeySearchPanelModule } from './components/search-panel/sankey-search-panel.module';
import { PathReportComponent } from './components/path-report/path-report.component';
import { SankeyAdvancedPanelDirective } from './directives/advanced-panel.directive';
import { SankeyViewCreateComponent } from './components/view/create/view-create.component';
import { SankeyViewDropdownComponent } from './components/view/dropdown/view-dropdown.component';
import { SankeyAdvancedPanelComponent } from './components/advanced-panel/advanced-panel.component';
import { SankeyViewConfirmComponent } from './components/view/confirm.component';
import { BaseViewsModule } from './base-views/base-views.module';
import { SankeyDetailsPanelComponent } from './components/details-panel/details-panel.component';
import { SANKEY_ADVANCED, SANKEY_DETAILS, SANKEY_GRAPH } from './DI';

@NgModule({
  declarations: [
    SankeyViewComponent,
    SankeyDirective,
    SankeyDetailsPanelDirective,
    SankeyAdvancedPanelDirective,
    PathReportComponent,
    SankeyViewConfirmComponent,
    SankeyViewCreateComponent,
    SankeyViewDropdownComponent,
    SankeyAdvancedPanelComponent
  ],
  imports: [
    CommonModule,
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
    SharedModule,
    FileBrowserModule,
    RouterModule.forRoot([]),
    SankeySearchPanelModule,
    // BaseViewsModule
  ],
  exports: [
    SankeyViewComponent
  ],
  providers: [
    ClipboardService
  ]
})
export class SankeyViewerLibModule {
}
