import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { combineLatest, Subscription } from 'rxjs';

import { PdfFile } from 'app/interfaces/pdf-files.interface';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { PdfFilesService } from 'app/shared/services/pdf-files.service';

@Component({
  selector: 'app-file-navigator',
  templateUrl: './file-navigator.component.html',
  styleUrls: ['./file-navigator.component.scss']
})
export class FileNavigatorComponent {

  loadTask: BackgroundTask<[], [PdfFile]>;
  fileLoadedSub: Subscription;

  projectName: string;
  fileId: string;
  fileName: string;

  constructor(
    readonly route: ActivatedRoute,
    private pdf: PdfFilesService,
  ) {
    this.projectName = this.route.snapshot.params.project_name;
    this.fileId = this.route.snapshot.params.file_id;

    this.loadTask = new BackgroundTask(() => {
      return combineLatest(
        this.pdf.getFileMeta(this.fileId, this.projectName),
      );
    });

    this.fileLoadedSub = this.loadTask.results$.subscribe(({
      result: [pdfFile],
      value: []
    }) => {
      this.fileName = pdfFile.filename;
    });

    this.loadTask.update([]);
  }
}
