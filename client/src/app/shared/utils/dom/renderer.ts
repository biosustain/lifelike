import { Observable } from 'rxjs';

export interface Renderer {
  /**
   * Upon subscription it kicks off rendering, unsuscribe to stop.
   */
  render$: Observable<void>;
}
