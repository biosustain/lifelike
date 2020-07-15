import {async, ComponentFixture, TestBed} from '@angular/core/testing';
import {configureTestSuite} from 'ng-bullet';

import {MapListComponent} from './map-list.component';
import {RouterModule} from '@angular/router';
import {RootStoreModule} from 'app/root-store';
import {DrawingToolModule} from 'app/drawing-tool/drawing-tool.module';
import {AngularMaterialModule} from 'app/shared/angular-material.module';
import {ProjectsService} from 'app/drawing-tool/services';
import {Injectable} from '@angular/core';
import {Observable, of} from 'rxjs';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {NodeSearchModule} from '../../../node-search/node-search.module';


@Injectable()
export class MockProjectsService extends ProjectsService {
  pullCommunityProjects(): Observable<any> {
    return of(this.projects);
  }

  pullProjects(): Observable<any> {
    return of(this.projects);
  }
}

describe('MapListComponent', () => {
  let component: MapListComponent;
  let fixture: ComponentFixture<MapListComponent>;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
      imports: [
        AngularMaterialModule,
        DrawingToolModule,
        RootStoreModule,
        RouterModule,
        BrowserAnimationsModule,
        NodeSearchModule
      ],
      providers: [
        ProjectsService
      ]
    })
      .compileComponents();
    TestBed.overrideProvider(ProjectsService, {useValue: new MockProjectsService(null)});
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MapListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
