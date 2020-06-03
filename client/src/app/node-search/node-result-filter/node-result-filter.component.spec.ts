import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NodeResultFilterComponent } from './node-result-filter.component';
import {RootStoreModule} from '../../root-store';
import {BrowserModule} from '@angular/platform-browser';
import {DragDropModule} from '@angular/cdk/drag-drop';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {NodeSearchModule} from '../node-search.module';

describe('NodeResultFilterComponent', () => {
  let component: NodeResultFilterComponent;
  let fixture: ComponentFixture<NodeResultFilterComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        NodeSearchModule,
        RootStoreModule,
        BrowserModule,
        DragDropModule,
        BrowserAnimationsModule
      ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NodeResultFilterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
