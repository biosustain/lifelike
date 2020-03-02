import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { TooltipComponent } from './tooltip.component';

describe('TooltipComponent', () => {
    let component: TooltipComponent;
    let fixture: ComponentFixture<TooltipComponent>;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            declarations: [ TooltipComponent ]
        })
        .compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(TooltipComponent);
        component = fixture.componentInstance;
        component.tooltipOptions = null;
        component.tooltipSelector = '#mock-element';

        const mockElement = document.createElement('div');
        mockElement.setAttribute('id', 'mock-element');

        // Mock document.querySelector so we can create a valid tooltip in the component
        // (querySelector is called once in the ngOnInit of the TooltipComponent)
        document.querySelector = jasmine.createSpy('HTML Element').and.returnValue(mockElement);

        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
