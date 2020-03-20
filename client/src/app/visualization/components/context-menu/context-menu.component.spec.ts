import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { ContextMenuComponent } from './context-menu.component';

import { SharedModule } from 'app/shared/shared.module';
import { RootStoreModule } from 'app/root-store';
import { ContextMenuControlService } from 'app/visualization/services/context-menu-control.service';

describe('ContextMenuComponent', () => {
    let component: ContextMenuComponent;
    let fixture: ComponentFixture<ContextMenuComponent>;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            declarations: [ContextMenuComponent],
            imports: [
                RootStoreModule,
                SharedModule,
            ],
            providers: [ContextMenuControlService],
        })
        .compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(ContextMenuComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
