import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MapPreviewComponent } from './map-preview.component';
import { DrawingToolModule } from 'app/drawing-tool/drawing-tool.module';
import { APP_BASE_HREF } from '@angular/common';
import { RootStoreModule } from 'app/root-store';
import { AngularMaterialModule } from 'app/shared/angular-material.module';
import { AppRoutingModule } from 'app/app-routing.module';
import { RouterModule } from '@angular/router';

describe('MapPreviewComponent', () => {
  let component: MapPreviewComponent;
  let fixture: ComponentFixture<MapPreviewComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        AngularMaterialModule,
        DrawingToolModule,
        RootStoreModule,
        RouterModule
      ],
      providers: [
        {provide: APP_BASE_HREF, useValue : '/' }
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
