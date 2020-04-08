import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { configureTestSuite } from 'ng-bullet';

import { MapSearchChannelComponent } from './map-search-channel.component';

describe('MapSearchChannelComponent', () => {
  let component: MapSearchChannelComponent;
  let fixture: ComponentFixture<MapSearchChannelComponent>;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
        declarations: [
          MapSearchChannelComponent
        ],
    });
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MapSearchChannelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
