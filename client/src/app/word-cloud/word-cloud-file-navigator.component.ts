import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BackgroundTask } from 'app/shared/rxjs/background-task';

import { LegendService } from 'app/shared/services/legend.service';
import { PdfFilesService } from 'app/shared/services/pdf-files.service';
import { combineLatest, Subscription } from 'rxjs';

import { WordCloudService } from './services/word-cloud.service';
import { WordCloudComponent } from './word-cloud.component';
import { WordCloudAnnotationFilterEntity } from '../interfaces/annotation-filter.interface';
import { FileViewComponent } from '../file-browser/components/file-view.component';
import { WorkspaceManager } from '../shared/workspace-manager';
import { escapeRegExp } from 'lodash';

@Component({
  selector: 'app-word-cloud-file-navigator',
  templateUrl: './word-cloud-file-navigator.component.html',
  styleUrls: ['./word-cloud.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class WordCloudFileNavigatorComponent {
}
