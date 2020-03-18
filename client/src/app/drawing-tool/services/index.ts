import {
    DataFlowService
} from './data-flow.service';
import {
    ProjectsService
} from './projects.service';
import {
    AuthenticationService
} from './authentication.service';
import {
    node_templates
} from './nodes';
import {
    PdfAnnotationsService,
} from './pdf-annotations.service';
import {
    DragDropEventFactory,
    ContainerModel
} from './event-factory';

/**
 * universally unique identitifer generator
 */
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * random short sequence generator
 */
function makeid(length=3) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
       result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }

export {
    DataFlowService,
    ProjectsService,
    AuthenticationService,
    PdfAnnotationsService,
    node_templates,
    uuidv4,
    makeid,
    DragDropEventFactory,
    ContainerModel
}