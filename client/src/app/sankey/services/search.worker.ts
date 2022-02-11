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
import { SankeySearch, SearchEntity } from './search-match';

addEventListener('message', async ({data}) => {
  const search = new SankeySearch(data);
  const generator = search.traverseAll();

  function step() {
    const match = generator.next();
    if (!match.done) {
      const {matchGenerator, ...rest} = match.value;
      postMessage({
        action: WorkerOutputActions.match,
        actionLoad: rest as SearchEntity
      });
      step();
    } else {
      postMessage({
        action: WorkerOutputActions.done
      });
    }
  }

  step();
  close();
});
