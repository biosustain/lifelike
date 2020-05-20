import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { APP_BASE_HREF } from '@angular/common';

import { ProjectListViewComponent } from './project-list-view.component';
import { DrawingToolModule } from '../drawing-tool.module';
import {NodeSearchModule} from '../../node-search/node-search.module';

// TODO: Looks like this is throwing an http error when the spec is cleaned up in `afterAll`.
// Could be that a service is being called with funky data, or maybe a service response isn't
// being handled correctly.
xdescribe('ProjectListViewComponent', () => {
  let component: ProjectListViewComponent;
  let fixture: ComponentFixture<ProjectListViewComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        DrawingToolModule,
        NodeSearchModule
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
