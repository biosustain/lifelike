import {
  ProjectsService,
} from './projects.service';
import {
  PdfAnnotationsService,
} from './pdf-annotations.service';
import {
  DragDropEventFactory,
  ContainerModel,
} from './event-factory';

// TODO: Should consolidate this with the existing shared method at the root of the app
/**
 * universally unique identitifer generator
 */
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {

    /* tslint:disable */
    let r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    /* tslint:enable */
    return v.toString(16);
  });
}

/**
 * random short sequence generator
 */
function makeid(length = 3) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

export {
  ProjectsService,
  PdfAnnotationsService,
  uuidv4,
  makeid,
  DragDropEventFactory,
  ContainerModel,
};
