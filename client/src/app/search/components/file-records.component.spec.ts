import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { FileRecordsComponent } from './file-records.component';

describe('FileRecordsComponent', () => {
  let component: FileRecordsComponent;
  let fixture: ComponentFixture<FileRecordsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ FileRecordsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(FileRecordsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
