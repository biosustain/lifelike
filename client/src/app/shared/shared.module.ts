/**
 * Commonly-used imports are grouped here for simpler use by feature modules.
 */
import { DragDropModule } from '@angular/cdk/drag-drop';
import { TextFieldModule } from '@angular/cdk/text-field';
import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlexLayoutModule } from '@angular/flex-layout';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

import { EffectsModule } from '@ngrx/effects';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { LinksPanelComponent } from 'app/drawing-tool/components/links-panel.component';

import { AngularSplitModule } from 'angular-split';
import { MessageDialogComponent } from './components/dialog/message-dialog.component';
import { ProgressDialogComponent } from './components/dialog/progress-dialog.component';
import { CopyLinkDialogComponent } from './components/dialog/copy-link-dialog.component';
import { SharedNgrxEffects } from './store/effects';
import { SharedSearchService } from './services/shared-search.service';
import { AccountsService } from './services/accounts.service';
import { DataTransferDataService } from './services/data-transfer-data.service';
import { SessionStorageService } from './services/session-storage.service';
import { InternalSearchService } from './services/internal-search.service';
import { ModuleModule } from './modules/module/module.module';
import components from './components';
import directives from './directives';
import pipes, { TruncatePipe } from './pipes';
import providers from './providers';
import modules from './modules';

@NgModule({
  entryComponents: [
    MessageDialogComponent,
    ProgressDialogComponent,
    CopyLinkDialogComponent,
    LinksPanelComponent,
  ],
  imports: [
    ...modules,
    CommonModule,
    HttpClientModule,
    FlexLayoutModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    AngularSplitModule.forRoot(),
    DragDropModule,
    EffectsModule.forFeature([SharedNgrxEffects]),
    TextFieldModule,
    NgbModule,
  ],
  declarations: [
    ...directives,
    ...components,
    ...pipes,
  ],
  providers: [
    TruncatePipe,
    MatSnackBar,
    SharedNgrxEffects,
    SharedSearchService,
    SessionStorageService,
    InternalSearchService,
    AccountsService,
    DataTransferDataService,
    ...providers
  ],
  // exported modules are visible to modules that import this one
  exports: [
    // Modules
    CommonModule,
    ModuleModule,
    HttpClientModule,
    FlexLayoutModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    AngularSplitModule,
    DragDropModule,
    TextFieldModule,
    NgbModule,
    // Directives
    ...directives,
    // Components
    ...components,
    // Pipes
    ...pipes,
  ],
})
export class SharedModule {}
