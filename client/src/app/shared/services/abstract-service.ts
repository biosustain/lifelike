import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthenticationService } from '../../auth/services/authentication.service';

export abstract class AbstractService {
  constructor(
    readonly auth: AuthenticationService,
    readonly http: HttpClient,
  ) {
  }

  protected getHttpOptions(authenticated = false, options: ServiceCallOptions = {}) {
    const headers: { [k: string]: string } = {};

    if (options.contentType != null) {
      headers['Content-Type'] = options.contentType;
    }

    if (authenticated) {
      headers.Authorization = `Bearer ${this.auth.getAccessToken()}`;
    }

    return {
      headers: new HttpHeaders(headers),
    };
  }
}

export interface ServiceCallOptions {
  contentType?: string;
}
