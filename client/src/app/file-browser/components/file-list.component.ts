import {Component, EventEmitter, Output} from '@angular/core';
import {PdfFilesService} from 'app/shared/services/pdf-files.service';
import {PdfFile} from 'app/interfaces/pdf-files.interface';
import {FormControl} from '@angular/forms';
import {Subscription} from 'rxjs';
import {BackgroundTask} from 'app/shared/rxjs/background-task';

@Component({
  selector: 'app-file-list',
  templateUrl: './file-list.component.html',
})
export class FileListComponent {
  @Output() fileSelect: EventEmitter<PdfFile> = new EventEmitter();
  refreshTask: BackgroundTask<void, PdfFile[]>;
  files: PdfFile[] = [];
  filteredFiles = this.files;
  filesFilter = new FormControl('');
  filesFilterSub: Subscription;

  constructor(private pdf: PdfFilesService) {
    this.filesFilterSub = this.filesFilter.valueChanges.subscribe(this.updateFilteredFiles.bind(this));
    this.refreshTask = new BackgroundTask<void, PdfFile[]>(
      () => this.pdf.getFiles()
    );
    this.refreshTask.results$.subscribe(({result: files}) => {
      this.files = files;
      this.updateFilteredFiles(this.filesFilter.value);
    });
    this.refresh();
  }

  refresh() {
    this.refreshTask.update();
  }

  selectionClicked(file: PdfFile) {
    this.fileSelect.emit(file);
  }

  private updateFilteredFiles(name: string) {
    const words = name.split(' ').filter(w => w.length).map(w => w.toLocaleLowerCase());
    this.filteredFiles = words.length
      ? this.files.filter((file: PdfFile) => words.some(w => file.filename.toLocaleLowerCase().includes(w)))
      : this.files;
  }
}
