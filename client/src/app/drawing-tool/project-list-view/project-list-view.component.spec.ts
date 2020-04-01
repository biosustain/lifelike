import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { APP_BASE_HREF } from '@angular/common';

import { ProjectListViewComponent } from './project-list-view.component';
import { MockupModule } from '../mockup.module';

// TODO: Looks like this is throwing an http error when the spec is cleaned up in `afterAll`.
// Could be that a service is being called with funky data, or maybe a service response isn't
// being handled correctly.
xdescribe('ProjectListViewComponent', () => {
  let component: ProjectListViewComponent;
  let fixture: ComponentFixture<ProjectListViewComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        MockupModule
      ],
      providers: [
        {provide: APP_BASE_HREF, useValue : '/' }
      ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ProjectListViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
