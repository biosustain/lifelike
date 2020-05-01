import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { LegendComponent } from './legend.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

describe('LegendComponent', () => {
    let component: LegendComponent;
    let fixture: ComponentFixture<LegendComponent>;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            declarations: [ LegendComponent ],
            imports: [
                BrowserAnimationsModule
            ]
        });
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(LegendComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
