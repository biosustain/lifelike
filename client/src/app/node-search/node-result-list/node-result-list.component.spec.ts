import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {NodeResultListComponent} from './node-result-list.component';
import {SharedModule} from '../../shared/shared.module';
import {NodeSearchModule} from '../node-search.module';
import {RootStoreModule} from '../../root-store';
import {BrowserModule} from '@angular/platform-browser';
import {DragDropModule} from '@angular/cdk/drag-drop';
import {SearchService} from '../../search/services/search.service';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';

describe('NodeResultListComponent', () => {
  let component: NodeResultListComponent;
  let fixture: ComponentFixture<NodeResultListComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        NodeSearchModule,
        RootStoreModule,
        BrowserModule,
        DragDropModule,
        BrowserAnimationsModule
      ],
      providers: [
        SearchService
      ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NodeResultListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
