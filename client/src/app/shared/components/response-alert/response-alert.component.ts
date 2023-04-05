import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';

import { ErrorResponse, WarningResponse } from '../../schemas/common';

type ResponseAlert = WarningResponse | ErrorResponse;
type ResponseAlertType =
  'success'
  | 'info'
  | 'warning'
  | 'danger'
  | 'primary'
  | 'secondary'
  | 'light'
  | 'dark';

@Component({
  selector: 'app-response-alert',
  templateUrl: './response-alert.component.html',
  styleUrls: ['./response-alert.component.scss']
})
export class ResponseAlertComponent implements OnChanges {
  @Input() responseAlert: ResponseAlert;
  @Input() dismissible: boolean;
  @Input() type: ResponseAlertType;
  responseTypeToAlertTypeMap: Map<string, ResponseAlertType> = new Map([
    ['Warning', 'warning'],
    ['Error', 'danger'],
  ]);

  ngOnChanges({responseAlert}: SimpleChanges) {
    if (!this.type && responseAlert) {
      this.type = this.responseTypeToAlertTypeMap.get(responseAlert.currentValue.type);
    }
  }
}
