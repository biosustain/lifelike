import { BehaviorSubject } from 'rxjs';

interface Action<Type extends string = string, Payload = any> {
  type: Type;
  payload: Payload;
}

type Reducer<State, Act extends Action> = (state: State, action: Act) => State;

export class RxjsStore<State extends object, Act extends Action> {
  constructor(
    private readonly initialState: State,
    private readonly reducers: ReadonlyArray<Reducer<State, Act>>
  ) {}

  private readonly _state$ = new BehaviorSubject<State>(this.initialState);
  public readonly state$ = this._state$.asObservable();

  public get state() {
    return this._state$.getValue();
  }

  public dispatch(action: Act) {
    return this._state$.next(
      this.reducers.reduce((state, reducer) => reducer(state, action), this.state)
    );
  }
}
