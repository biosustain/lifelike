import { TestBed } from '@angular/core/testing';

import { PdfViewerLibService } from './pdf-viewer-lib.service';

describe('PdfViewerLibService', () => {
  let service: PdfViewerLibService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.get(PdfViewerLibService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
