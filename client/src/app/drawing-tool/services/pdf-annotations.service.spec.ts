import { TestBed } from '@angular/core/testing';

import { PdfAnnotationsService } from './pdf-annotations.service';

describe('PdfAnnotationsService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: PdfAnnotationsService = TestBed.get(PdfAnnotationsService);
    expect(service).toBeTruthy();
  });
});
