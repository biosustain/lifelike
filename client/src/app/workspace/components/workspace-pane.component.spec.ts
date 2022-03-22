import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkspacePaneComponent } from './workspace-pane.component';

describe('WorkspacePaneComponent', () => {
  let component: WorkspacePaneComponent;
  let fixture: ComponentFixture<WorkspacePaneComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ WorkspacePaneComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WorkspacePaneComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
