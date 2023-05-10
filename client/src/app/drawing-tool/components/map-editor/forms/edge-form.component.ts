import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges, OnDestroy,
  Output, SimpleChanges,
  ViewChild,
} from '@angular/core';

import { cloneDeep, isNil } from 'lodash-es';
import { Observable, ReplaySubject } from 'rxjs';
import { filter, map, switchMap } from 'rxjs/operators';
import { flow as _flow, pick as _pick, some as _some, values as _values } from 'lodash/fp';

import { UniversalGraphEdge } from 'app/drawing-tool/services/interfaces';
import { LINE_HEAD_TYPES } from 'app/drawing-tool/services/line-head-types';
import { RecursivePartial } from 'app/shared/utils/types';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { LINE_TYPES } from 'app/drawing-tool/services/line-types';
import { PALETTE_COLORS } from 'app/drawing-tool/services/palette';
import { InfoPanel } from 'app/drawing-tool/models/info-panel';
import { CanvasGraphView } from 'app/graph-viewer/renderers/canvas/canvas-graph-view';
import { ExplainService } from 'app/shared/services/explain.service';
import { InternalSearchService } from 'app/shared/services/internal-search.service';

import { getTermsFromEdge, getTermsFromGraphEntityArray } from '../../../utils/terms';
import { EntityForm } from './entity-form';

@Component({
  selector: 'app-edge-form',
  styleUrls: ['./entity-form.component.scss'],
  templateUrl: './edge-form.component.html',
})
export class EdgeFormComponent extends EntityForm implements OnChanges, OnDestroy {
  @Input() graphView: CanvasGraphView;
  lineHeadTypeChoices = [
    [
      null,
      {
        name: '(Default)',
      },
    ],
    ...LINE_HEAD_TYPES.entries(),
  ];

  originalEdge: UniversalGraphEdge;
  updatedEdge: UniversalGraphEdge;

  change$ = new ReplaySubject<SimpleChanges>(1);
  possibleExplanation$: Observable<string> = this.change$.pipe(
    map(_pick(['edge', 'graphView'])),
    filter(_flow(
      _values,
      _some(Boolean)
    )),
    switchMap(() =>
      this.explainService.relationship(
        new Set<string>(
          getTermsFromEdge.call(
            // We might run into situation when only one of them is beeing changed
            // therefore it is safe to address them this way
            this.graphView,
            this.edge
          )
        )
      )
    )
  );

  @Output() save = new EventEmitter<{
    originalData: RecursivePartial<UniversalGraphEdge>;
    updatedData: RecursivePartial<UniversalGraphEdge>;
  }>();
  @Output() delete = new EventEmitter<object>();
  @Output() sourceOpen = new EventEmitter<string>();

  constructor(
    protected readonly workspaceManager: WorkspaceManager,
    protected readonly explainService: ExplainService
  ) {
    super(workspaceManager);
  }

  ngOnChanges(changes: SimpleChanges) {
    this.change$.next(changes);
  }

  ngOnDestroy() {
    this.change$.complete();
  }

  get hyperlinks() {
    return isNil(this.edge.data.hyperlinks) ? [] : this.edge.data.hyperlinks;
  }

  get edge() {
    return this.updatedEdge;
  }

  @Input()
  set edge(edge) {
    this.originalEdge = cloneDeep(edge);
    this.originalEdge.data = this.originalEdge.data || {};
    this.originalEdge.style = this.originalEdge.style || {};

    this.updatedEdge = cloneDeep(edge);
    this.updatedEdge.data = this.updatedEdge.data || {};
    this.updatedEdge.data.sources = this.updatedEdge.data.sources || [];
    this.updatedEdge.data.hyperlinks = this.updatedEdge.data.hyperlinks || [];
    this.updatedEdge.style = this.updatedEdge.style || {};

    // Anytime the view is changed (i.e. when a new edge is selected) re-focus the label field.
    if (this.viewInited) {
      this.focus();
    }
  }

  doSave() {
    this.save.next({
      originalData: {
        label: this.originalEdge.label,
        data: {
          sources: this.originalEdge.data.sources,
          hyperlinks: this.originalEdge.data.hyperlinks,
          detail: this.originalEdge.data.detail,
        },
        style: {
          fontSizeScale: this.originalEdge.style.fontSizeScale,
          strokeColor: this.originalEdge.style.strokeColor,
          lineType: this.originalEdge.style.lineType,
          lineWidthScale: this.originalEdge.style.lineWidthScale,
          sourceHeadType: this.originalEdge.style.sourceHeadType,
          targetHeadType: this.originalEdge.style.targetHeadType,
        },
      },
      updatedData: {
        label: this.updatedEdge.label,
        data: {
          sources: this.updatedEdge.data.sources,
          hyperlinks: this.updatedEdge.data.hyperlinks,
          detail: this.updatedEdge.data.detail,
        },
        style: {
          fontSizeScale: this.updatedEdge.style.fontSizeScale,
          strokeColor: this.updatedEdge.style.strokeColor,
          lineType: this.updatedEdge.style.lineType,
          lineWidthScale: this.updatedEdge.style.lineWidthScale,
          sourceHeadType: this.updatedEdge.style.sourceHeadType,
          targetHeadType: this.updatedEdge.style.targetHeadType,
        },
      },
    });
    this.originalEdge = cloneDeep(this.updatedEdge);
  }

  /**
   * Create a blank hyperlink template to add to model
   */
  addHyperlink() {
    if (isNil(this.edge.data.hyperlinks)) {
      this.edge.data.hyperlinks = [];
    }

    const [domain, url] = ['', ''];
    this.edge.data.hyperlinks.push({ url, domain });
  }

  /**
   * Remove hyperlink from specified index
   * @param i - index of hyperlink to remove
   */
  removeHyperlink(i) {
    this.edge.data.hyperlinks.splice(i, 1);
    this.doSave();
  }
}
