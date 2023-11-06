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
import { ScrollingModule } from '@angular/cdk/scrolling';
import { CdkTreeModule } from '@angular/cdk/tree';
import { MatTooltipModule } from '@angular/material/tooltip';

import { EffectsModule } from '@ngrx/effects';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { AngularSplitModule } from 'angular-split';
import { SharedNgrxEffects } from './store/effects';
import { SharedSearchService } from './services/shared-search.service';
import {
  DATA_TRANSFER_DATA_PROVIDER,
  DataTransferDataService,
} from './services/data-transfer-data.service';
import { InternalSearchService } from './services/internal-search.service';
import { GenericDataProvider } from './providers/data-transfer-data/generic-data.provider';
import components from './components';
import pipes from './pipes';
import directives from './directives';
import UtilsModule from './modules/utils';
import PlaceholderModule from './modules/placeholder';
import ModalModule from './modules/modal';
import ControlsModule from './modules/controls';
import AppModuleModule from './modules/app-module';
import LinkModule from './modules/link';
import LoadingIndicatorModule from './modules/loading-indicator';
import TreeViewModule from './modules/tree-view';
import HighlightTextModule from './modules/highlight-text';

const modulesImportExport = [
  // region Library modules
  CdkTreeModule,
  CommonModule,
  DragDropModule,
  FlexLayoutModule,
  FormsModule,
  HttpClientModule,
  NgbModule,
  ReactiveFormsModule,
  RouterModule,
  ScrollingModule,
  TextFieldModule,
  // endregion
  AppModuleModule,
  ControlsModule,
  HighlightTextModule,
  LinkModule,
  LoadingIndicatorModule,
  ModalModule,
  PlaceholderModule,
  TreeViewModule,
  UtilsModule,
];

@NgModule({
  imports: [
    AngularSplitModule.forRoot(),
    EffectsModule.forFeature([SharedNgrxEffects]),
    MatTooltipModule,
    ...modulesImportExport,
  ],
  declarations: [
    // Directives
    ...directives,
    // Pipes
    ...pipes,
    // Components
    ...components,
  ],
  providers: [
    DataTransferDataService,
    GenericDataProvider,
    InternalSearchService,
    SharedNgrxEffects,
    SharedSearchService,
    {
      provide: DATA_TRANSFER_DATA_PROVIDER,
      useClass: GenericDataProvider,
      multi: true,
    },
  ],
  exports: [
    // Declarations to be ussed when importing shared module
    // Modules
    AngularSplitModule,
    RouterModule,
    ...modulesImportExport,
    // Directives
    ...directives,
    // Components
    ...components,
    // Pipes
    ...pipes,
  ],
})
export class SharedModule {}
