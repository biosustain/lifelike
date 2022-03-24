import { Component, OnDestroy, OnInit, } from '@angular/core';
import { FormBuilder, Validators, FormControl, FormGroup } from '@angular/forms';

import { map } from 'rxjs/operators';
import { partition, keys } from 'lodash-es';

import { ControllerService } from 'app/sankey/services/controller.service';

import { SankeyAbstractAdvancedPanelComponent } from '../../abstract/advanced-panel.component';
import { SankeyState, SankeyOptions } from '../../interfaces';

@Component({
  selector: 'app-advanced-panel',
  templateUrl: './advanced-panel.component.html',
  styleUrls: ['./advanced-panel.component.scss'],
})
export class SankeyAdvancedPanelComponent
  extends SankeyAbstractAdvancedPanelComponent<SankeyOptions, SankeyState>
  implements OnInit, OnDestroy {
  constructor(
    protected common: ControllerService,
    protected formBuilder: FormBuilder
  ) {
    super(common, formBuilder);
  }

  form = this.formBuilder.group({
    traceGroups: this.formBuilder.group({}),
    alignId: [undefined, []],
    normalizeLinks: ['', []],
    fontSizeScale: [1, []],
    labelEllipsis: this.formBuilder.group({
      enabled: [false, []],
      value: [0, Validators.pattern(/^\d+$/)],
    }),
    prescalerId: [undefined, []],
  });

  prescalers$ = this.common.prescalers$;
  aligns$ = this.common.aligns$;
  traceGroups$ = this.common.options$.pipe(
    map(options => options.traceGroups),
    // distinctUntilChanged(isEqual),
    // shareReplay({ bufferSize: 1, refCount: true })
  );

  get traceGroupsControls() {
    return (this.form.get('traceGroups') as FormGroup).controls;
  }

  ngOnInit() {
    super.ngOnInit();
    this.common.viewName$.subscribe(viewName => {
      if (viewName) {
        this.form.get('prescalerId').disable();
        this.form.get('alignId').disable();
      } else {
        this.form.get('prescalerId').enable();
        this.form.get('alignId').enable();
      }
    });

    this.traceGroups$.subscribe(traceGroups => {
      const traceGroupsFormGroup = this.form.get('traceGroups') as FormGroup;
      const currentTraceGroups = keys(traceGroupsFormGroup.controls);
      const [dropedTraceGroups, newTraceGroups] = partition(
        traceGroups,
        traceGroup => currentTraceGroups.includes(traceGroup)
      );
      newTraceGroups.forEach(traceGroup => {
        traceGroupsFormGroup.addControl(traceGroup, new FormControl(true));
      });
      dropedTraceGroups.forEach(traceGroup => {
        traceGroupsFormGroup.removeControl(traceGroup);
      });
    });
  }

  ngOnDestroy() {
    super.ngOnDestroy();
  }
}
