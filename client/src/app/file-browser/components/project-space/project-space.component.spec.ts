import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectSpaceComponent } from './project-space.component';

describe('ProjectSpaceComponent', () => {
  let component: ProjectSpaceComponent;
  let fixture: ComponentFixture<ProjectSpaceComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ProjectSpaceComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ProjectSpaceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
