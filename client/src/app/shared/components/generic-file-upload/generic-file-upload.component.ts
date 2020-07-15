import { Component, Output, EventEmitter, Input } from '@angular/core';

@Component({
    selector: 'app-generic-file-upload',
    templateUrl: './generic-file-upload.component.html',
    styleUrls: ['./generic-file-upload.component.scss']
})
export class GenericFileUploadComponent {
    @Output() fileChanged: EventEmitter<File> = new EventEmitter();

    // string should be in the same format as the 'accept' attribute on file input html elements
    @Input() accept: string;

    fileName: string;

    constructor() {}

    onFileChange(event: any) {
        this.fileName = event.target.files[0].name;
        this.fileChanged.emit(event.target.files[0]);
    }

}
