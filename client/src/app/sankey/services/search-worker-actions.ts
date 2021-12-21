export enum WorkerActions {
  update,
  search,
  stop
}

export enum WorkerOutputActions {
  interrupted,
  match,
  done
}

export interface SearchWorkerMessage {
  action: WorkerActions;
  actionLoad: any;
}
