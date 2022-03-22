import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkspaceTabComponent } from './workspace-tab.component';

describe('WorkspaceTabComponent', () => {
  let component: WorkspaceTabComponent;
  let fixture: ComponentFixture<WorkspaceTabComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ WorkspaceTabComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WorkspaceTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
