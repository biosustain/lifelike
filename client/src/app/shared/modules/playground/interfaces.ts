import { HttpDownloadProgressEvent, HttpErrorResponse, HttpEvent } from '@angular/common/http';

import { Observable } from 'rxjs';

interface RequestWrapping<Params> {
  params: Params;
  loading$: Observable<boolean>;
  error$: Observable<HttpErrorResponse>;
  cost$: Observable<number>;
  cached$: Observable<boolean>;
}

interface Request<Params, Result> extends RequestWrapping<Params> {
  result$: Observable<Result>;
}

interface RequestStream<Params, Result> extends RequestWrapping<Params> {
  result$: Observable<HttpEvent<Result> | HttpDownloadProgressEvent>;
}

export type WrappedRequest<Params, Result> = Params extends { stream: true }
  ? RequestStream<Params, Result>
  : Request<Params, Result>;
