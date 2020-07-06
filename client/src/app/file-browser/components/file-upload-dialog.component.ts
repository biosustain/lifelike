import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { SelectionModel } from '@angular/cdk/collections';
import { FormControl } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { Subscription } from 'rxjs';

import { UploadPayload, UploadType } from '../../interfaces/pdf-files.interface';


@Component({
  selector: 'app-dialog-upload',
  templateUrl: './file-upload-dialog.component.html',
})
export class FileUploadDialogComponent implements OnInit, OnDestroy {
  @Input() payload: UploadPayload; // to avoid writing this.data.payload everywhere

  forbidUpload = true;
  pickedFileName: string;
  selection = new SelectionModel<string>(false, []);

  filename = new FormControl('');
  filenameChange: Subscription;
  url = new FormControl('');
  urlChange: Subscription;

  activeTab = 'upload';
  readonly annotationMethods = ['NLP', 'Rules Based'];

  constructor(public activeModal: NgbActiveModal) {
  }

  ngOnInit() {
    this.filenameChange = this.filename.valueChanges.subscribe((value: string) => {
      this.payload.filename = value;
      this.validatePayload();
    });
    this.urlChange = this.url.valueChanges.subscribe((value: string) => {
      this.payload.url = value;
      this.filename.setValue(this.extractFilenameFromUrl(value));
      this.validatePayload();
    });
  }

  ngOnDestroy() {
    this.filenameChange.unsubscribe();
    this.urlChange.unsubscribe();
  }

  /** Called upon picking a file from the Browse button */
  onFilesPick(fileList: FileList) {
    this.payload.files = this.transformFileList(fileList);
    this.pickedFileName = fileList.length ? fileList[0].name : '';
    this.filename.setValue(this.pickedFileName);
    this.validatePayload();
  }

  /** Validates if the Upload button should be enabled or disabled */
  validatePayload() {
    this.payload.type = this.activeTab === 'upload' ? UploadType.Files : UploadType.Url;
    const filesIsOk = this.payload.files && this.payload.files.length > 0;
    const filenameIsOk = this.payload.filename && this.payload.filename.length > 0;
    const urlIsOk = this.payload.url && this.payload.url.length > 0;
    const annotationMethodSelected = this.selection.selected.length > 0;
    if (this.activeTab === 'upload') {
      this.forbidUpload = !(filesIsOk && annotationMethodSelected);
    } else { // UploadType.Url
      this.forbidUpload = !(filenameIsOk && urlIsOk && annotationMethodSelected);
    }
  }

  onAnnotationMethodPick(method: string) {
    this.selection.toggle(method);
    this.payload.annotationMethod = method;
    this.validatePayload();
  }

  /** Transforms a FileList to a File[]
   * Not sure why, but I can't pass a FileList back to the parent component
   */
  private transformFileList(fileList: FileList): File[] {
    const files: File[] = [];
    for (let i = 0; i < fileList.length; ++i) {
      files.push(fileList.item(i));
    }
    return files;
  }

  /** Attempts to extract a filename from a URL */
  private extractFilenameFromUrl(url: string): string {
    return url.substring(url.lastIndexOf('/') + 1);
  }
}
