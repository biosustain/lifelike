import { TestBed } from '@angular/core/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { configureTestSuite } from 'ng-bullet';

import { ClipboardService } from './clipboard.service';

describe('ClipboardService', () => {
  let service: ClipboardService;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
      imports: [MatSnackBarModule],
      providers: [ClipboardService]
    });
  });

  beforeEach(() => {
    service = TestBed.get(ClipboardService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // NOTE: Leaving this code as legancy for now. Our aplication no longer is ussing readClipboard method and this test has been also
  // disabled.
  // // Currently this is failing. The reason for this seems to be that the mock web page generated
  // // by Karma is not given focus. The Clipboard APIs will only run if the page they are executed on
  // // has focus.
  //
  // // One solution for this might be to create a ClipboardServiceTestComponent and write tests for the
  // // service in the spec for the component. Then we could focus an element in the component template.
  //
  // // Even if we did do that, this test would still fail because we can't get permission to read/write
  // // the clipboard in the headless chrome instance. There doesn't seem to be a way to grant permission
  // // to the runner, and there also isn't a way to programmatically ask for permission, AFAIK.
  // xit('should read and write text to the clipboard', async () => {
  //     const stringToCopy = 'My very important string';
  //     await service.writeToClipboard(stringToCopy);
  //
  //     const clipboardText = await service.readClipboard();
  //     expect(clipboardText).toEqual(stringToCopy);
  // });
});
