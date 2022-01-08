/// <reference lib="webworker" />

import { defer } from 'lodash-es';

import { uuidv4 } from 'app/shared/utils/identifiers';

import { SearchWorkerMessage, WorkerActions, WorkerOutputActions } from './search-worker-actions';
import { SankeySearch } from './search-match';
import { SearchEntity } from '../components/search-panel/interfaces';

const search = new SankeySearch();
let searchId;

addEventListener('message', async ({data: messageData}) => {
  const {
    action,
    actionLoad
  } = (messageData as SearchWorkerMessage);
  if (action === WorkerActions.update) {
    search.update(actionLoad);
  } else if (action === WorkerActions.search) {
    const thisSearchId = uuidv4();
    searchId = thisSearchId;
    const generator = search.traverseAll();

    function step() {
      const match = generator.next();
      if (!match.done) {
        const {matchGenerator, ...rest} = match.value;
        if (thisSearchId === searchId) {
          postMessage({
            action: WorkerOutputActions.match,
            actionLoad: rest as SearchEntity
          });
          defer(step);
        } else {
          postMessage({
            action: WorkerOutputActions.interrupted
          });
        }
      } else {
        postMessage({
          action: WorkerOutputActions.done
        });
      }
    }

    step();
  } else if (action === WorkerActions.stop) {
    searchId = undefined;
  }
});



