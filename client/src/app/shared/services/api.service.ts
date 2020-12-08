import { AbstractService, ServiceCallOptions } from './abstract-service';
import { Injectable } from '@angular/core';
import { AuthenticationService } from '../../auth/services/authentication.service';
import { HttpClient } from '@angular/common/http';

@Injectable()
export class ApiService extends AbstractService {
  constructor(auth: AuthenticationService, http: HttpClient) {
    super(auth, http);
  }

  public getHttpOptions(authenticated = false, options: ServiceCallOptions = {}) {
    return super.getHttpOptions(...arguments);
  }
}
