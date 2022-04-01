import { MonoTypeOperatorFunction } from 'rxjs';

// Just for clarity, rxjs operator is func(source: Observable<T>) => Observable<R>
// So we can skip it by simply forwarding the source observable
export const skipStep  = (d => d) as MonoTypeOperatorFunction<any>;
