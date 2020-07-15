import { APP_BASE_HREF } from '@angular/common';
import {
  async,
  ComponentFixture,
  TestBed
} from '@angular/core/testing';

import { SplitterComponent } from './splitter.component';

import { DrawingToolModule } from '../drawing-tool.module';
import {NodeSearchModule} from '../../node-search/node-search.module';
import { RootStoreModule } from 'app/***ARANGO_USERNAME***-store';
import { RouterTestingModule } from '@angular/router/testing';

describe('SplitterComponent', () => {
  let component: SplitterComponent;
  let fixture: ComponentFixture<SplitterComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        RootStoreModule,
        RouterTestingModule,
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
    fixture = TestBed.createComponent(SplitterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
