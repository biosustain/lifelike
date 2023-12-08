import { assign, has, isEmpty, isNil, pick, toPairs } from 'lodash-es';
import { Subject } from 'rxjs';

import {
  Source,
  UniversalEntityData,
  UniversalGraphNode,
} from 'app/drawing-tool/services/interfaces';
import { AppUser, OrganismAutocomplete } from 'app/interfaces';
import { PdfFile } from 'app/interfaces/pdf-files.interface';
import { DirectoryObject } from 'app/interfaces/projects.interface';
import { Meta } from 'app/pdf-viewer/annotation-type';
import { annotationTypesMap } from 'app/shared/annotation-styles';
import { FAClass, MimeTypes, Unicodes } from 'app/shared/constants';
import { CollectionModel, ObservableObject } from 'app/shared/utils/collection-model';
import { DragImage } from 'app/shared/utils/drag';
import { RecursivePartial } from 'app/shared/utils/types';
import { getSupportedFileCodes } from 'app/shared/utils';
import {
  FILESYSTEM_IMAGE_HASHID_TYPE,
  FILESYSTEM_IMAGE_TRANSFER_TYPE,
} from 'app/drawing-tool/providers/image-entity-data.provider';
import { GenericDataProvider } from 'app/shared/providers/data-transfer-data/generic-data.provider';
import { AppURL } from 'app/shared/utils/url';

import { FilePrivileges, ProjectPrivileges } from './privileges';
import {
  FILESYSTEM_OBJECT_TRANSFER_TYPE,
  FilesystemObjectTransferData,
} from '../providers/filesystem-object-data.provider';
import { AnnotationConfigurations, FilesystemObjectData, ProjectData } from '../schema';
import { createDragImage } from '../utils/drag';
import { PublishService } from '../services/publish.service';

// TODO: Rename this class after #unifiedfileschema
export class ProjectImpl implements ObservableObject {
  /**
   * Legacy ID field that needs to go away.
   */
  id?: number;
  hashId: string;
  name: string;
  description: string;
  creator: AppUser;
  creationDate: string;
  modifiedDate: string;
  ***ARANGO_USERNAME***: FilesystemObject;
  privileges: ProjectPrivileges;
  fontAwesomeIcon = `fa-4x ${FAClass.Project}`;
  readonly changed$ = new Subject();

  get starred(): boolean {
    return this.***ARANGO_USERNAME***?.starred;
  }

  set starred(value) {
    if (this.***ARANGO_USERNAME***) {
      this.***ARANGO_USERNAME***.update({ starred: value });
    }
  }

  get public(): boolean {
    return this.***ARANGO_USERNAME***?.public;
  }

  set public(value) {
    if (this.***ARANGO_USERNAME***) {
      this.***ARANGO_USERNAME***.update({ public: value });
    }
  }

  get isPublication() {
    return /^!publish@/.exec(this.name);
  }

  get effectiveName(): string {
    if (this.isPublication) {
      const username = (this.creator ?? this.***ARANGO_USERNAME***?.user)?.username;
      if (username) {
        return `Publications of ${username}`;
      }
      return `Publications`;
    }
    return this.name || this.hashId;
  }

  get projectName() {
    return this.name;
  }

  get directory() {
    return this.***ARANGO_USERNAME*** ? this.***ARANGO_USERNAME***.directory : null;
  }

  update(data: RecursivePartial<ProjectData>): ProjectImpl {
    if (data == null) {
      return this;
    }
    for (const key of [
      'hashId',
      'name',
      'description',
      'creator',
      'creationDate',
      'modifiedDate',
      'privileges',
      'starred',
    ]) {
      if (data.hasOwnProperty(key)) {
        this[key] = data[key];
      }
    }
    if (data.hasOwnProperty('***ARANGO_USERNAME***')) {
      if (isNil(data.***ARANGO_USERNAME***)) {
        this.***ARANGO_USERNAME*** = null;
        // TODO: Error?
      } else {
        const ***ARANGO_USERNAME*** = this.***ARANGO_USERNAME*** ?? new FilesystemObject();
        ***ARANGO_USERNAME***.update(data.***ARANGO_USERNAME***);
        ***ARANGO_USERNAME***.project = this;
        this.***ARANGO_USERNAME*** = ***ARANGO_USERNAME***;
      }
    }
    this.changed$.next(data);
    return this;
  }

  getCommands(forEditing: boolean = false): any[] {
    return ['/folders', this.***ARANGO_USERNAME***.hashId];
  }

  getURL(): AppURL {
    return new AppURL().update({
      pathSegments: this.getCommands().map((item) => encodeURIComponent(item.replace(/^\//, ''))),
      fragment: 'project',
    });
  }

  get colorHue(): number {
    let hash = 3242;
    for (let i = 0; i < this.hashId.length; i++) {
      // tslint:disable-next-line:no-bitwise
      hash = (hash << 3) + hash + this.hashId.codePointAt(i);
    }
    return (hash % 100) / 100;
  }

  addDataTransferData(dataTransfer: DataTransfer) {
    createProjectDragImage(this).addDataTransferData(dataTransfer);

    const node: Partial<Omit<UniversalGraphNode, 'data'>> & { data: Partial<UniversalEntityData> } =
      {
        display_name: this.name,
        label: 'link',
        sub_labels: [],
        data: {
          references: [
            {
              type: 'PROJECT_OBJECT',
              id: this.id + '',
            },
          ],
          sources: [
            {
              domain: 'File Source',
              url: this.getURL().toAbsolute().toString(),
            },
          ],
        },
      };

    dataTransfer.effectAllowed = 'all';
    dataTransfer.setData('text/plain', this.effectiveName);
    dataTransfer.setData('application/***ARANGO_DB_NAME***-node', JSON.stringify(node));

    GenericDataProvider.setURIs(
      dataTransfer,
      [
        {
          title: this.effectiveName,
          uri: this.getURL().toAbsolute(),
        },
      ],
      { action: 'append' }
    );
  }
}

/**
 * This object represents both directories and every type of file in Lifelike. Due
 * to a lot of legacy code, we implement several legacy interfaces to reduce the
 * amount of code for the refactor.
 */
export class FilesystemObject implements DirectoryObject, PdfFile, ObservableObject {
  hashId: string;
  filename: string;
  user: AppUser;
  description: string;
  mimeType: string;
  doi: string;
  public: boolean;
  pinned: boolean;
  uploadUrl: string;
  annotationsDate: string;
  readonly creationDate: string;
  readonly modifiedDate: string;
  updatedTimestamp: number;
  recyclingDate: string;
  project: ProjectImpl;
  parent: FilesystemObject;
  readonly children = new CollectionModel<FilesystemObject>([], {
    multipleSelection: true,
    sort: this.defaultSort,
  });
  privileges: FilePrivileges;
  fallbackOrganism?: OrganismAutocomplete;
  recycled: boolean;
  effectivelyRecycled: boolean;
  annotationConfigs?: AnnotationConfigurations;
  // TODO: Remove this if we ever give ***ARANGO_USERNAME*** files actual names instead of '/'. This mainly exists
  // as a helper for getting the real name of a ***ARANGO_USERNAME*** file.
  trueFilename: string;
  path: string;
  size: string;

  contexts: string[];
  highlight?: string[];
  highlightAnnotated?: boolean[];
  annotationsTooltipContent: string;
  starred?: boolean;
  readonly changed$ = new Subject();

  get isDirectory() {
    return this.mimeType === MimeTypes.Directory;
  }

  /**
   * Top directories (without parents) are projects.
   */
  get isProjectRoot() {
    return this.isDirectory && !this.parent;
  }

  get isFile() {
    return !this.isDirectory;
  }

  get isOpenable() {
    switch (this.mimeType) {
      case MimeTypes.Directory:
      case MimeTypes.Map:
      case MimeTypes.EnrichmentTable:
      case MimeTypes.Graph:
      case MimeTypes.BioC:
      case 'application/pdf':
        return true;
      default:
        return false;
    }
  }

  get isEditable() {
    // TODO: Move this method to ObjectTypeProvider
    return !(this.isDirectory && !this.parent);
  }

  get isAnnotatable() {
    // TODO: Move this method to ObjectTypeProvider
    return (
      this.mimeType === 'application/pdf' ||
      this.mimeType === 'vnd.***ARANGO_DB_NAME***.document/enrichment-table'
    );
  }

  get promptOrganism() {
    return this.mimeType !== MimeTypes.EnrichmentTable;
  }

  get isMovable() {
    // TODO: Move this method to ObjectTypeProvider
    return !(this.isDirectory && !this.parent);
  }

  get isCloneable() {
    // TODO: Move this method to ObjectTypeProvider
    return this.isFile;
  }

  get isDeletable() {
    // TODO: Move this method to ObjectTypeProvider
    return true;
  }

  get isVersioned() {
    // TODO: Move this method to ObjectTypeProvider
    return this.mimeType === MimeTypes.Map;
  }

  get isNavigable() {
    // TODO: Move this method to ObjectTypeProvider
    return this.isDirectory || this.isAnnotatable;
  }

  get hasWordCloud() {
    // TODO: Move this method to ObjectTypeProvider
    return (
      this.isDirectory ||
      this.mimeType === MimeTypes.Pdf ||
      this.mimeType === MimeTypes.EnrichmentTable
    );
  }

  /**
   * @deprecated
   */
  get locator(): PathLocator {
    if (this.type === 'dir') {
      return {
        projectName: this.project.name,
        directoryId: this.hashId,
      };
    } else if (this.parent != null) {
      return this.parent.locator;
    } else {
      throw new Error('no locator available');
    }
  }

  /**
   * @deprecated
   */
  get directory(): FilesystemObject {
    // noinspection JSDeprecatedSymbols
    if (this.type === 'dir') {
      return this;
    } else {
      throw new Error('no directory available');
    }
  }

  /**
   * @deprecated
   */
  get directoryParentId(): string {
    if (this.parent != null) {
      return this.parent.hashId;
    } else {
      return null;
    }
  }

  get mimeTypeLabel() {
    // TODO: Move this method to ObjectTypeProvider
    switch (this.mimeType) {
      case MimeTypes.Directory:
        return 'Folder';
      case MimeTypes.Map:
        return 'Map';
      case MimeTypes.BioC:
        return 'Bioc';
      case MimeTypes.EnrichmentTable:
        return 'Enrichment Table';
      case 'application/pdf':
        return 'Document';
      default:
        return 'File';
    }
  }

  get fontAwesomeIcon() {
    if (this.mimeType.startsWith('image/')) {
      return 'fa fa-file-image';
    } else if (this.mimeType.startsWith('video/')) {
      return 'fa fa-file-video';
    } else if (this.mimeType.startsWith('text/')) {
      return 'fa fa-file-alt';
    }

    // TODO: Move this method to ObjectTypeProvider
    switch (this.mimeType) {
      case MimeTypes.Directory:
        if (this.isProjectRoot) {
          return FAClass.Project;
        }
        return FAClass.Directory;
      case MimeTypes.Map:
        return FAClass.Map;
      case MimeTypes.BioC:
        return FAClass.BioC;
      case MimeTypes.EnrichmentTable:
        return FAClass.EnrichmentTable;
      case MimeTypes.Graph:
        return FAClass.Graph;
      case MimeTypes.Pdf:
        return FAClass.Pdf;
      default:
        const matchedIcon = getSupportedFileCodes(this.filename);
        if (matchedIcon !== undefined) {
          return matchedIcon.FAClass;
        }
        return FAClass.Default;
    }
  }

  get fontAwesomeIconCode() {
    // TODO: Move this method to ObjectTypeProvider
    switch (this.mimeType) {
      case MimeTypes.Directory:
        return Unicodes.Directory;
      case MimeTypes.Map:
        return Unicodes.Map;
      case MimeTypes.BioC:
        return Unicodes.BioC;
      case MimeTypes.EnrichmentTable:
        return Unicodes.EnrichmentTable;
      case MimeTypes.Graph:
        return Unicodes.Graph;
      case MimeTypes.Pdf:
        return Unicodes.Pdf;
      default:
        const matchedIcon = getSupportedFileCodes(this.filename);
        if (matchedIcon !== undefined) {
          return matchedIcon.unicode;
        }
        return Unicodes.Default;
    }
  }

  get mapNodeLabel() {
    switch (this.mimeType) {
      case MimeTypes.Map:
        return 'map';
      default:
        return 'link';
    }
  }

  /**
   * @deprecated
   */
  get projectsId(): string {
    return this.project != null ? this.project.hashId : null;
  }

  /**
   * @deprecated
   */
  get type(): 'dir' | 'file' | 'map' {
    switch (this.mimeType) {
      case MimeTypes.Directory:
        return 'dir';
      case MimeTypes.Map:
        return 'map';
      default:
        return 'file';
    }
  }

  get effectiveName(): string {
    if (this.isProjectRoot) {
      return this.project.effectiveName;
    } else {
      return this.filename;
    }
  }

  get new(): boolean {
    return this.creationDate === this.modifiedDate;
  }

  static normalizeFilename(filter: string): string {
    return filter.trim().toLowerCase().replace(/[ _]+/g, ' ');
  }

  filterChildren(filter: string) {
    const normalizedFilter = FilesystemObject.normalizeFilename(filter);
    this.children.setFilter(
      isEmpty(normalizedFilter)
        ? null
        : (item: FilesystemObject) =>
            FilesystemObject.normalizeFilename(item.filename).includes(normalizedFilter)
    );
  }

  getCommands(forEditing = true): any[] {
    // TODO: Move this method to ObjectTypeProvider
    const projectName = encodeURIComponent(
      this.project?.effectiveName?.replace(/\s/g, '_') ?? 'default'
    );
    switch (this.mimeType) {
      case MimeTypes.Directory:
        return ['/folders', this.hashId];
      case MimeTypes.EnrichmentTable:
        return ['/projects', projectName, 'enrichment-table', this.hashId];
      case MimeTypes.Pdf:
        return ['/projects', projectName, 'files', this.hashId];
      case MimeTypes.BioC:
        return ['/projects', projectName, 'bioc', this.hashId];
      case MimeTypes.Map:
        return ['/projects', projectName, 'maps', this.hashId];
      case MimeTypes.Graph:
        return ['/projects', projectName, 'sankey', this.hashId];
      default:
        return ['/files', this.hashId];
    }
  }

  // TODO: Move this method to ObjectTypeProvider
  getURL(forEditing = true, meta?: Meta): AppURL {
    const url = new AppURL().update({
      pathSegments: this.getCommands(forEditing).map((item) =>
        encodeURIComponent(item.replace(/^\//, ''))
      ),
      fragment: this.isProjectRoot ? 'project' : '',
    });
    switch (this.mimeType) {
      case MimeTypes.EnrichmentTable:
        if (!isNil(meta)) {
          url.fragment = new URLSearchParams({
            id: meta.id,
            text: meta.allText,
            color: annotationTypesMap.get(meta.type.toLowerCase()).color,
          }).toString();
        }
        break;
    }
    url.searchParams.set('filename', this.effectiveName.replace(/\s/g, '_'));
    return url;
  }

  getGraphEntitySources(meta?: Meta): Source[] {
    const sources = [];

    sources.push({
      domain: this.effectiveName,
      url: this.getURL(false, meta),
    });

    if (this.doi != null) {
      sources.push({
        domain: 'DOI',
        url: this.doi,
      });
    }

    if (this.uploadUrl != null) {
      sources.push({
        domain: 'External URL',
        url: this.uploadUrl,
      });
    }

    return sources;
  }

  getTransferData() {
    const filesystemObjectTransfer: FilesystemObjectTransferData = {
      hashId: this.hashId,
      privileges: this.privileges,
    };

    const sources: Source[] = this.getGraphEntitySources();

    const node: Partial<Omit<UniversalGraphNode, 'data'>> & { data: Partial<UniversalEntityData> } =
      {
        display_name: this.effectiveName,
        label: this.mimeType === MimeTypes.Map ? 'map' : 'link',
        sub_labels: [],
        data: {
          references: [
            {
              type: 'PROJECT_OBJECT',
              id: this.hashId + '',
            },
          ],
          sources,
        },
      };
    if (this.mimeType.trim().startsWith('image/')) {
      return {
        [FILESYSTEM_IMAGE_HASHID_TYPE]: this.hashId,
        [FILESYSTEM_IMAGE_TRANSFER_TYPE]: JSON.stringify(node),
      };
    }
    return {
      'text/plain': this.effectiveName,
      [FILESYSTEM_OBJECT_TRANSFER_TYPE]: JSON.stringify(filesystemObjectTransfer),
      ['application/***ARANGO_DB_NAME***-node']: JSON.stringify(node),
      ...GenericDataProvider.getURIs([
        {
          uri: this.getURL(false).toAbsolute(),
          title: this.filename,
        },
      ]),
    };
  }

  addDataTransferData(dataTransfer: DataTransfer) {
    // TODO: Move to DataTransferData framework
    createObjectDragImage(this).addDataTransferData(dataTransfer);

    const dragData = this.getTransferData();
    toPairs(dragData).forEach((args) => dataTransfer.setData(...args));

    GenericDataProvider.setURIs(
      dataTransfer,
      [
        {
          title: this.effectiveName,
          uri: this.getURL(false).toAbsolute(),
        },
      ],
      { action: 'append' }
    );
  }

  private defaultSort(a: FilesystemObject, b: FilesystemObject) {
    return (
      // Sort pinned files first
      Number(b.pinned) - Number(a.pinned) ||
      // Sort directories first
      Number(b.mimeType === MimeTypes.Directory) - Number(a.mimeType === MimeTypes.Directory) ||
      // Sort files by timestamp
      b.updatedTimestamp - a.updatedTimestamp ||
      // Sort files by name
      a.filename.localeCompare(b.filename)
    );
  }

  update(data: RecursivePartial<FilesystemObjectData>): FilesystemObject {
    if (data == null) {
      return this;
    }

    assign(
      this,
      pick(data, [
        'hashId',
        'size',
        'filename',
        'user',
        'description',
        'mimeType',
        'doi',
        'public',
        'contexts',
        'pinned',
        'annotationsDate',
        'uploadUrl',
        'highlight',
        'fallbackOrganism',
        'creationDate',
        'modifiedDate',
        'recyclingDate',
        'privileges',
        'recycled',
        'effectivelyRecycled',
        'fallbackOrganism',
        'annotationConfigs',
        'path',
        'trueFilename',
        'starred',
      ])
    );

    if (has(data, 'modifiedDate')) {
      this.updatedTimestamp = Date.parse(data.modifiedDate);
    } else if (has(data, 'creationDate')) {
      this.updatedTimestamp = Date.parse(data.creationDate);
    }
    if ('parent' in data) {
      this.parent = data.parent ? this.parent ?? new FilesystemObject() : null;
    }
    if ('project' in data) {
      this.project = data.project ? this.project ?? new ProjectImpl() : null;
    }
    if (this.parent) {
      this.parent.project = this.parent.project ?? this.project;
    }
    if (this.project && this.isProjectRoot) {
      this.project.***ARANGO_USERNAME*** = this.project.***ARANGO_USERNAME*** ?? this;
    }
    if (data.parent) {
      this.parent.update(data.parent);
    }
    if (data.project) {
      this.project.update(data.project);
    }
    if ('children' in data) {
      if (data.children != null) {
        this.children.replace(
          data.children.map((itemData) => {
            const child = new FilesystemObject();
            child.parent = this;
            if (this.project != null) {
              child.project = this.project;
            }
            return child.update(itemData);
          })
        );
      } else {
        this.children.replace([]);
      }
    }
    this.changed$.next(data);
    return this;
  }

  get ***ARANGO_USERNAME***(): FilesystemObject {
    let ***ARANGO_USERNAME***: FilesystemObject = this;
    while (***ARANGO_USERNAME***.parent != null) {
      ***ARANGO_USERNAME*** = ***ARANGO_USERNAME***.parent;
    }
    return ***ARANGO_USERNAME***;
  }
}

export interface PathLocator {
  projectName?: string;
  directoryId?: string;
}

export function createProjectDragImage(project: ProjectImpl): DragImage {
  return createDragImage(project.name, '\uf5fd');
}

export function createObjectDragImage(object: FilesystemObject): DragImage {
  return createDragImage(object.filename, object.fontAwesomeIconCode);
}
