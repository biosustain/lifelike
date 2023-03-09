import { Injectable } from "@angular/core";
import { HttpHandler, HttpInterceptor, HttpRequest } from "@angular/common/http";

import { environment } from "environments/environment";
import { Observable } from "rxjs";

@Injectable()
export class AppVersionInterceptor implements HttpInterceptor {
  constructor() {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<any> {
    return next.handle(this.addVersionHeader(req));
  }

  addVersionHeader(request: HttpRequest<any>) {
    return request.clone({
      setHeaders: {
        "Accept-Lifelike-Version": environment.***ARANGO_DB_NAME***Version,
      },
    });
  }
}
