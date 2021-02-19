/**
 * Commonly-used imports are grouped here for simplier use by feature modules.
 */
import { DragDropModule } from '@angular/cdk/drag-drop';
import { TextFieldModule } from '@angular/cdk/text-field';
import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlexLayoutModule } from '@angular/flex-layout';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { EffectsModule } from '@ngrx/effects';

import { AngularSplitModule } from 'angular-split';

import { AngularMaterialModule } from './angular-material.module';
import { HighlightSnippetComponent } from './components/highlight-snippet.component';
import { LegendComponent } from './components/legend.component';
import { MessageDialogComponent } from './components/dialog/message-dialog.component';
import { NodeRelationshipComponent } from './components/node-relationship-display.component';
import { ProgressDialogComponent } from './components/dialog/progress-dialog.component';
import { TooltipComponent } from './components/tooltip.component';
import { SharedDirectivesModule } from './directives/shareddirectives.module';
import { SharedNgrxEffects } from './store/effects';
import { FriendlyDateStrPipe, ScrubHtmlPipe, TruncatePipe } from './pipes';
import { NodeTextStylePipe } from './node-text-style.pipe';
import { OrganismAutocompleteComponent } from './components/organism-autocomplete.component';
import { SharedSearchService } from './services/shared-search.service';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { SortLegendComponent } from './components/sort-legend.component';
import { ConfirmDialogComponent } from './components/dialog/confirm-dialog.component';
import { FormInputFeedbackComponent } from './components/form/form-input-feedback.component';
import { BackgroundTaskProgressComponent } from './components/background-task-progress.component';
import { FormRowComponent } from './components/form/form-row.component';
import { ModalHeaderComponent } from './components/modal/modal-header.component';
import { ModalBodyComponent } from './components/modal/modal-body.component';
import { ModalFooterComponent } from './components/modal/modal-footer.component';
import { LoadingIndicatorComponent } from './components/loading-indicator.component';
import { ContentProgressComponent } from './components/content-progress.component';
import { ColorChooserComponent } from './components/form/color-chooser.component';
import { PercentInputComponent } from './components/form/percent-input.component';
import { SelectComponent } from './components/form/select.component';
import { ResultsSummaryComponent } from './components/results-summary.component';
import { QuickSearchComponent } from './components/quick-search.component';
import { CollapsibleWindowComponent } from './components/collapsible-window.component';
import { GenericFileUploadComponent } from './components/generic-file-upload/generic-file-upload.component';
import { SourcesComponent } from './components/sources/sources.component';
import { ModuleErrorComponent } from './components/module-error.component';
import { ModuleProgressComponent } from './components/module-progress.component';
import { ShareDialogComponent } from './components/dialog/share-dialog.component';
import { AnnotationFilterComponent } from './components/annotation-filter/annotation-filter.component';
import { WordCloudAnnotationFilterComponent } from './components/word-cloud-annotation-filter/word-cloud-annotation-filter.component';
import { GenericTableComponent } from './components/table/generic-table.component';
import { HighlightTextComponent } from './components/highlight-text.component';
import { AddStatusPipe } from './pipes/add-status.pipe';
import { TermHighlightComponent } from './components/term-highlight.component';
import { ApiService } from './services/api.service';
import { VisJsNetworkComponent } from './components/vis-js-network/vis-js-network.component';
import { PlotlySankeyDiagramComponent } from './components/plotly-sankey-diagram/plotly-sankey-diagram.component';
import { SearchControlComponent } from './components/search-control.component';
import { UserComponent } from './components/user.component';
import { SelectInputComponent } from './components/form/select-input.component';
import { UserSelectComponent } from './components/form/user-select.component';
import { AccountsService } from './services/accounts.service';
import { ResultControlComponent } from './components/result-control.component';
import { PaginationComponent } from './components/pagination.component';

const components = [
  VisJsNetworkComponent,
  PlotlySankeyDiagramComponent,
  AnnotationFilterComponent,
  WordCloudAnnotationFilterComponent,
  MessageDialogComponent,
  ProgressDialogComponent,
  HighlightSnippetComponent,
  LegendComponent,
  NodeRelationshipComponent,
  TooltipComponent,
  SortLegendComponent,
  ConfirmDialogComponent,
  OrganismAutocompleteComponent,
  FormInputFeedbackComponent,
  BackgroundTaskProgressComponent,
  FormRowComponent,
  ModalHeaderComponent,
  ModalBodyComponent,
  ModalFooterComponent,
  ContentProgressComponent,
  LoadingIndicatorComponent,
  ColorChooserComponent,
  PercentInputComponent,
  SelectComponent,
  ResultsSummaryComponent,
  QuickSearchComponent,
  CollapsibleWindowComponent,
  GenericFileUploadComponent,
  SourcesComponent,
  ModuleErrorComponent,
  ModuleProgressComponent,
  ShareDialogComponent,
  GenericTableComponent,
  HighlightTextComponent,
  TermHighlightComponent,
  SearchControlComponent,
  UserComponent,
  SelectInputComponent,
  UserSelectComponent,
  ResultControlComponent,
  PaginationComponent,
];

@NgModule({
  entryComponents: [
    MessageDialogComponent,
    ProgressDialogComponent,
    ShareDialogComponent,
  ],
  imports: [
    CommonModule,
    HttpClientModule,
    AngularMaterialModule,
    FlexLayoutModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    SharedDirectivesModule,
    AngularSplitModule.forRoot(),
    DragDropModule,
    EffectsModule.forFeature([SharedNgrxEffects]),
    TextFieldModule,
    NgbModule,
  ],
  declarations: [
    ...components,
    TruncatePipe,
    FriendlyDateStrPipe,
    NodeTextStylePipe,
    ScrubHtmlPipe,
    AddStatusPipe
  ],
  providers: [
    ApiService,
    SharedNgrxEffects,
    SharedSearchService,
    ApiService,
    AccountsService,
  ],
  // exported modules are visible to modules that import this one
  exports: [
    // Modules
    CommonModule,
    HttpClientModule,
    AngularMaterialModule,
    FlexLayoutModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    SharedDirectivesModule,
    AngularSplitModule,
    DragDropModule,
    TextFieldModule,
    // Components
    ...components,
    TruncatePipe,
    ScrubHtmlPipe,
    FriendlyDateStrPipe,
    NodeTextStylePipe,
    NgbModule,
    AddStatusPipe
  ],
})
export class SharedModule {
}
