import { Component, Input } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { groupBy, values } from 'lodash-es';
import { defer } from 'rxjs';

import { SankeyPathReport } from 'app/sankey/interfaces/report';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';

@Component({
  selector: 'app-sankey-validation-report',
  templateUrl: './validation-report.component.html',
  styleUrls: ['./validation-report.component.scss'],
})
export class ValidationReportComponent {
  @Input() hashId: string;
  validationReport$ = defer(() => this.filesystemService.validate(this.hashId));

  constructor(
    public activeModal: NgbActiveModal,
    protected readonly filesystemService: FilesystemService
  ) {}
}
