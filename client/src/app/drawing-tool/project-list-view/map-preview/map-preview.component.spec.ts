import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MapPreviewComponent } from './map-preview.component';
import { DrawingToolModule } from 'app/drawing-tool/drawing-tool.module';
import { APP_BASE_HREF } from '@angular/common';
import { RootStoreModule } from 'app/***ARANGO_USERNAME***-store';
import { AngularMaterialModule } from 'app/shared/angular-material.module';
import { RouterTestingModule } from '@angular/router/testing';
import { NodeSearchModule } from '../../../node-search/node-search.module';

describe('MapPreviewComponent', () => {
  let component: MapPreviewComponent;
  let fixture: ComponentFixture<MapPreviewComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        AngularMaterialModule,
        DrawingToolModule,
        NodeSearchModule,
        RootStoreModule,
        RouterTestingModule
      ],
      providers: [
        {provide: APP_BASE_HREF, useValue: '/'}
      ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MapPreviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
