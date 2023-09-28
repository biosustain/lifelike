import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';

import { ErrorResponse, InformationResponse, WarningResponse } from '../../../../schemas/common';

type ResponseAlert = InformationResponse | WarningResponse | ErrorResponse;
type ResponseAlertType =
  | 'success'
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
  styleUrls: ['./response-alert.component.scss'],
})
export class ResponseAlertComponent implements OnChanges {
  @Input() responseAlert: ResponseAlert;
  @Input() dismissible: boolean;
  @Input() type: ResponseAlertType | string;
  @Input() alertClass: string;
  _type: ResponseAlertType;
  responseTypeToAlertTypeMap: Map<string, ResponseAlertType> = new Map([
    ['Warning', 'warning'],
    ['Error', 'danger'],
    ['Info', 'info'],
  ]);

  ngOnChanges({ responseAlert, type }: SimpleChanges) {
    if (type && this.responseTypeToAlertTypeMap.has(type.currentValue)) {
      this._type = this.responseTypeToAlertTypeMap.has(type.currentValue)
        ? this.responseTypeToAlertTypeMap.get(type.currentValue)
        : type.currentValue;
    }
    if (!this.type && responseAlert) {
      this._type = this.responseTypeToAlertTypeMap.get(responseAlert.currentValue.type);
    }
  }
}
