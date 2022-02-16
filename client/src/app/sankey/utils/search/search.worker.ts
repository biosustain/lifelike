/// <reference lib="webworker" />

/* NOTE:
    Be very carefull with those imports as they cannot have any DOM references
    since they are executed in a web worker enviroment.
    Faulty import will prevent the worker from compiling, returning the error of type:
     "document is undefined"
     "window is undefined"
     "alert is undefined"
*/
import { WorkerOutputActions } from './search-worker-actions';
import { SankeySearch } from './search-match';

addEventListener('message', async ({data}) => {
  const search = new SankeySearch(data);
  const [generator, multiMatchesGenerator] = search.traverseAll();

  for (const match of generator) {
    postMessage({
      action: WorkerOutputActions.match,
      actionLoad: match
    });
  }
  // Potentially to be supported in future
  // for (const match of multiMatchesGenerator) {
  //   postMessage({
  //     action: WorkerOutputActions.update,
  //     actionLoad: match
  //   });
  // }
  postMessage({
    action: WorkerOutputActions.done
  });
  close();
});
