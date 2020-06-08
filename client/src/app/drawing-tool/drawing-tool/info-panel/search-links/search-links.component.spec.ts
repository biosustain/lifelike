import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { SearchLinksComponent } from './search-links.component';
import { SharedModule } from 'app/shared/shared.module';
import { RootStoreModule } from 'app/root-store';

describe('SearchLinksComponent', () => {
  let component: SearchLinksComponent;
  let fixture: ComponentFixture<SearchLinksComponent>;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
        imports: [
            SharedModule,
            RootStoreModule
        ],
        declarations: [
          SearchLinksComponent
        ]
    });

    fixture = TestBed.createComponent(SearchLinksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
