import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpHandler,
  HttpRequest,
} from '@angular/common/http';

import { environment } from 'environments/environment';
import { Observable } from 'rxjs';


@Injectable()
export class AppVersionInterceptor implements HttpInterceptor {
    constructor() {}

    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<any> {
      return next.handle(this.addVersionHeader(req));
    }

    addVersionHeader(request: HttpRequest<any>) {
      return request.clone({
          setHeaders: {
              'Lifelike-version': environment.lifelikeVersion,
          }
      });
    }
}
