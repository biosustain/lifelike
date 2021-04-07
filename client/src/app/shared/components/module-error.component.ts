import { Component, Input } from '@angular/core';
import { UserError } from '../exceptions';
import { ErrorHandler } from '../services/error-handler.service';
import { Observable, of } from 'rxjs';

@Component({
  selector: 'app-module-error',
  templateUrl: './module-error.component.html',
  styleUrls: [
    './module-error.component.scss'
  ],
})
export class ModuleErrorComponent {
  userError$: Observable<UserError>;

  constructor(protected readonly errorHandler: ErrorHandler) {
  }

  @Input()
  set error(error: any) {
    this.userError$ = error != null ? this.errorHandler.createUserError(error, {
      transactionId: '', // This error is not logged so we don't have a transaction ID
    }) : of(null);
  }
}
