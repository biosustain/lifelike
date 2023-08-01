import { HttpDownloadProgressEvent, HttpErrorResponse, HttpEvent } from '@angular/common/http';

import { Observable } from 'rxjs';

export interface RequestWrapping<Arguments extends Array<any>, Result> {
  arguments: Arguments;
  loading$: Observable<boolean>;
  error$: Observable<HttpErrorResponse>;
  result$: Observable<Result>;
}

export interface CompletionRequestWrapping<Params, Result> extends Omit<RequestWrapping<[Params], Result>, 'arguments'> {
  params: Params;
  cost$: Observable<number>;
  cached$: Observable<boolean>;
}

export type CompletionRequest<Params, Result> = CompletionRequestWrapping<Params, { result: Result, cached: boolean }>;

export type CompletionRequestStream<Params, Result> =
  CompletionRequestWrapping<Params, HttpEvent<Result> | HttpDownloadProgressEvent>;
