import { Component, OnDestroy, OnInit, } from '@angular/core';
import { FormBuilder, Validators, AbstractControl } from '@angular/forms';

import { isInteger } from 'lodash-es';

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
    shortestPathPlusN: [1, []],
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
  maximumLabelLength$ = this.common.maximumLabelLength$;
  maximumShortestPathPlusN$ = this.common.maximumShortestPathPlusN$;
  aligns$ = this.common.aligns$;

  ngOnInit() {
    super.ngOnInit();

    this.maximumShortestPathPlusN$.subscribe(maximumShortestPathPlusN => {
      this.form.get('shortestPathPlusN').setValidators([
        ({value}: AbstractControl) => {
          if (!isInteger(value)) {
            return {
              step: {
                value,
                fraction: value % 1
              }
            };
          }
        },
        Validators.min(0),
        Validators.max(maximumShortestPathPlusN),
      ]);
    });
  }

  ngOnDestroy() {
    super.ngOnDestroy();
  }
}
