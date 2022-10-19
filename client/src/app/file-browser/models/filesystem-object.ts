import { isNil, isEmpty, has, toPairs, assign, pick, omit } from 'lodash-es';
import { Subject } from 'rxjs';

import { KnowledgeMap, Source, UniversalEntityData, KnowledgeMapGraph, UniversalGraphNode, } from 'app/drawing-tool/services/interfaces';
import { AppUser, OrganismAutocomplete, User } from 'app/interfaces';
import { PdfFile } from 'app/interfaces/pdf-files.interface';
import { Meta } from 'app/pdf-viewer/annotation-type';
import { annotationTypesMap } from 'app/shared/annotation-styles';
import { MimeTypes, Unicodes, FAClass } from 'app/shared/constants';
import { CollectionModel, ObservableObject } from 'app/shared/utils/collection-model';
import { DragImage } from 'app/shared/utils/drag';
import { RecursivePartial } from 'app/shared/utils/types';
import { getSupportedFileCodes } from 'app/shared/utils';
import { FILESYSTEM_IMAGE_HASHID_TYPE, FILESYSTEM_IMAGE_TRANSFER_TYPE } from 'app/drawing-tool/providers/image-entity-data.provider';

import { FilePrivileges } from './privileges';
import { FILESYSTEM_OBJECT_TRANSFER_TYPE, FilesystemObjectTransferData } from '../providers/filesystem-object-data.provider';
import { AnnotationConfigurations, FilesystemObjectData } from '../schema';
import { createDragImage } from '../utils/drag';
/**
 * This object represents both directories and every type of file in Lifelike. Due
 * to a lot of legacy code, we implement several legacy interfaces to reduce the
 * amount of code for the refactor.
 */
export class FilesystemObject implements PdfFile, KnowledgeMap, ObservableObject {
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
  protected updatedTimestamp: number;
  recyclingDate: string;
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

  highlight?: string[];
  highlightAnnotated?: boolean[];
  annotationsTooltipContent: string;
  starred?: boolean;
  changed$ = new Subject();

  get isDirectory() {
    return this.mimeType === MimeTypes.Directory;
  }

  get project(): FilesystemObject {
    return this.parent?.project ?? this;
  }

  /**
   * Top directories (without parents) are projects.
   */
  get isProject() {
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
    return this.mimeType === 'application/pdf' ||
      this.mimeType === 'vnd.***ARANGO_DB_NAME***.document/enrichment-table';
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
    return this.isDirectory || this.mimeType === MimeTypes.Pdf || this.mimeType === MimeTypes.EnrichmentTable;
  }

  /**
   * @deprecated
   */
  get locator(): PathLocator {
    if (this.type === 'dir') {
      return {
        projectName: this.project.filename,
        directoryId: this.hashId
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
  get file_id(): string {
    return this.hashId;
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

  /**
   * @deprecated
   */
  get name(): string {
    return this.filename;
  }

  get effectiveName(): string {
      return this.filename;
  }

  /**
   * @deprecated
   */
  get label(): string {
    return this.filename;
  }

  /**
   * @deprecated
   */
  get graph(): KnowledgeMapGraph {
    return null;
  }

  /**
   * @deprecated
   */
  get upload_url(): string {
    return this.uploadUrl;
  }

  /**
   * @deprecated
   */
  get annotations_date(): string {
    return this.annotationsDate;
  }

  /**
   * @deprecated
   */
  get annotationDate(): string {
    return this.annotationsDate;
  }

  /**
   * @deprecated
   */
  get creation_date(): string {
    return this.creationDate;
  }

  /**
   * @deprecated
   */
  get modified_date(): string {
    return this.modifiedDate;
  }

  /**
   * @deprecated
   */
  get modificationDate(): string {
    return this.modifiedDate;
  }

  /**
   * @deprecated
   */
  get creator(): User {
    return this.user;
  }

  /**
   * @deprecated
   */
  get id(): string {
    return this.hashId;
  }

  /**
   * @deprecated
   */
  get data(): FilesystemObject | KnowledgeMap | PdfFile {
    return this;
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
      isEmpty(normalizedFilter) ? null :
        (item: FilesystemObject) => FilesystemObject.normalizeFilename(item.name).includes(normalizedFilter)
    );
  }

  getCommands(forEditing = true): any[] {
    // TODO: Move this method to ObjectTypeProvider
    const projectName = this.project ? this.project.filename : 'default';
    switch (this.mimeType) {
      case MimeTypes.Directory:
        if (this.isProject) {
          return ['/projects', projectName];
        }
        return ['/projects', projectName, 'folders', this.hashId];
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

  getURL(forEditing = true, meta?: Meta): string {
    // TODO: Move this method to ObjectTypeProvider
    const url = '/' + this.getCommands(forEditing).map(item => {
      return encodeURIComponent(item.replace(/^\//, ''));
    }).join('/');

    switch (this.mimeType) {
      case MimeTypes.EnrichmentTable:
        let fragment = '';
        if (!isNil(meta)) {
          fragment = '#' + [
            `id=${encodeURIComponent(meta.id)}`,
            `text=${encodeURIComponent(meta.allText)}`,
            `color=${encodeURIComponent(annotationTypesMap.get(meta.type.toLowerCase()).color)}`
          ].join('&');
        }
        return url + fragment;
      default:
        return url;
    }
  }

  getGraphEntitySources(meta?: Meta): Source[] {
    const sources = [];

    sources.push({
      domain: this.filename,
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

    const node: Partial<Omit<UniversalGraphNode, 'data'>> & { data: Partial<UniversalEntityData> } = {
      display_name: this.filename,
      label: this.mimeType === MimeTypes.Map ? 'map' : 'link',
      sub_labels: [],
      data: {
        references: [{
          type: 'PROJECT_OBJECT',
          id: this.hashId + '',
        }],
        sources,
      },
    };
    if (this.mimeType.trim().startsWith('image/')) {
      return {
        [FILESYSTEM_IMAGE_HASHID_TYPE]: this.hashId,
        [FILESYSTEM_IMAGE_TRANSFER_TYPE]: JSON.stringify(node)
      };
    }
    return {
      'text/plain': this.filename,
      [FILESYSTEM_OBJECT_TRANSFER_TYPE]: JSON.stringify(filesystemObjectTransfer),
      ['application/***ARANGO_DB_NAME***-node']: JSON.stringify(node)
    };
  }

  addDataTransferData(dataTransfer: DataTransfer) {
    // TODO: Move to DataTransferData framework
    createObjectDragImage(this).addDataTransferData(dataTransfer);

    const dragData = this.getTransferData();
    toPairs(dragData).forEach(args => dataTransfer.setData(...args));
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
      a.name.localeCompare(b.name)
    );
  }

  update(data: RecursivePartial<FilesystemObjectData>): FilesystemObject {
    if (data == null) {
      return this;
    }

    assign(this, pick(
      data,
      [
        'hashId', 'filename', 'user', 'description', 'mimeType', 'doi', 'public', 'pinned', 'annotationsDate', 'uploadUrl',
        'highlight', 'fallbackOrganism', 'creationDate', 'modifiedDate', 'recyclingDate', 'privileges', 'recycled', 'effectivelyRecycled',
        'fallbackOrganism', 'annotationConfigs', 'path', 'trueFilename', 'starred'
      ]
    ));

    if (has(data, 'modifiedDate')) {
      this.updatedTimestamp = Date.parse(data.modifiedDate);
    } else if (has(data, 'creationDate')) {
      this.updatedTimestamp = Date.parse(data.creationDate);
    }
    if ('parent' in data) {
      this.parent = data.parent ? this.parent ?? new FilesystemObject() : null;
    }
    if (data.parent) {
      this.parent.update(data.parent);
    }
    if ('children' in data) {
      if (data.children != null) {
        this.children.replace(data.children.map(
          itemData => {
            const child = new FilesystemObject();
            child.parent = this;
            return child.update(itemData);
          }));
      } else {
        this.children.replace([]);
      }
    }
    this.changed$.next(data);
    return this;
  }
}

export interface PathLocator {
  projectName?: string;
  directoryId?: string;
}

export function createProjectDragImage(project: FilesystemObject): DragImage {
  return createDragImage(project.filename, '\uf5fd');
}

export function createObjectDragImage(object: FilesystemObject): DragImage {
  return createDragImage(object.filename, object.fontAwesomeIconCode);
}
