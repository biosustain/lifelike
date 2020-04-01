import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MapSearchChannelComponent } from './map-search-channel.component';

describe('MapSearchChannelComponent', () => {
  let component: MapSearchChannelComponent;
  let fixture: ComponentFixture<MapSearchChannelComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ MapSearchChannelComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MapSearchChannelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
