import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { CopyProjectDialogComponent } from './copy-project-dialog.component';

describe('CopyProjectDialogComponent', () => {
  let component: CopyProjectDialogComponent;
  let fixture: ComponentFixture<CopyProjectDialogComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ CopyProjectDialogComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CopyProjectDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
