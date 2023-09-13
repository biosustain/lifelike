import { TestBed } from '@angular/core/testing';
import { HttpClientModule } from '@angular/common/http';

import { ChatgptUsageService } from './chatgpt-usage.service';

describe('ChatgptUsageService', () => {
  let service: ChatgptUsageService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientModule],
    });
    service = TestBed.inject(ChatgptUsageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
