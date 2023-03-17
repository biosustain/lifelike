import { Subject } from 'rxjs';

import { FilesystemObject, ProjectImpl } from 'app/file-browser/models/filesystem-object';
import { ProjectPrivileges, FilePrivileges } from 'app/file-browser/models/privileges';
import { AppUser, OrganismAutocomplete } from 'app/interfaces';
import { AnnotationConfigurations } from 'app/file-browser/schema';

import { CollectionModel, ObservableObject } from '../../utils/collection-model';
import { FAClass } from '../../constants';
import {
  DATE,
  FA_ICON,
  LOADING,
  loadingText,
  timestampLoadingMock,
} from './utils';
import { appUserLoadingMock } from './user';

const changed$ = new Subject();

export const filePrivilegesLoadingMock: FilePrivileges = {
  readable: true,
  writable: true,
  commentable: true,
};

export const filesystemObjectLoadingMock:
  (children?: FilesystemObject[], project?: ProjectImpl) => FilesystemObject
  = (children: FilesystemObject[] = [], project: ProjectImpl = projectImplLoadingMock()) => {
  const mock = {
    privileges: filePrivilegesLoadingMock,
    children: new CollectionModel(children),
    hashId: LOADING,
    filename: loadingText(),
    effectiveName: loadingText(),
    user: appUserLoadingMock,
    description: loadingText(),
    mimeType: LOADING,
    doi: LOADING,
    public: false,
    pinned: false,
    uploadUrl: LOADING,
    annotationsDate: DATE,
    creationDate: DATE,
    fontAwesomeIcon: FA_ICON,
    modifiedDate: DATE,
    updatedTimestamp: timestampLoadingMock(),
    recyclingDate: DATE,
    recycled: false,
    effectivelyRecycled: false,
    trueFilename: loadingText(),
    path: LOADING,
    annotationsTooltipContent: loadingText(),
    project,
    parent: project.***ARANGO_USERNAME***,
    getCommands() {

    },
    changed$,
  } as any as FilesystemObject;
  children.forEach(child => child.parent = mock);
  return mock;
};

export const projectPrivilegesLoadingMock: ProjectPrivileges = {
  readable: false,
  writable: false,
  administrable: false,
};

export const projectImplLoadingMock: () => ProjectImpl = () => {
  const mock = {
    hashId: LOADING,
    name: LOADING,
    starred: false,
    public: false,
    effectiveName: LOADING,
    projectName: LOADING,
    creationDate: DATE,
    modifiedDate: DATE,
    privileges: projectPrivilegesLoadingMock,
    fontAwesomeIcon: `fa-4x ${FA_ICON}`,
    getCommands() {
    },
    changed$,
  } as any;
  mock.***ARANGO_USERNAME*** = filesystemObjectLoadingMock([], mock);
  return mock;
};
