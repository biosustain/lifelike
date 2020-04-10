import { TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { ClipboardService } from './clipboard.service';

describe('ClipboardService', () => {
    let service: ClipboardService;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            providers: [ ClipboardService ]
        });
    });

    beforeEach(() => {
        service = TestBed.get(ClipboardService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    // Currently this is failing. The reason for this seems to be that the mock web page generated
    // by Karma is not given focus. The Clipboard APIs will only run if the page they are executed on
    // has focus. Not sure if there's a good solution for this...
    xit('should read and write text to the clipboard', async () => {
        const stringToCopy = 'My very important string';
        await service.writeToClipboard(stringToCopy);

        const clipboardText = await service.readClipboard();
        expect(clipboardText).toEqual(stringToCopy);
    });
});
