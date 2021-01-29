import { Directory } from '../services/project-space.service';
import { CollectionModal } from '../../shared/utils/collection-modal';
import { nullCoalesce } from '../../shared/utils/types';
import moment from 'moment';
import { DirectoryObject } from '../../interfaces/projects.interface';
import { PdfFile } from '../../interfaces/pdf-files.interface';
import { KnowledgeMap, UniversalGraphNode } from '../../drawing-tool/services/interfaces';

export class FilesystemObject implements DirectoryObject {
  locator: PathLocator;
  directory: Directory;
  path: Directory[];

  type = null;
  id = null;
  name = null;
  description = null;
  annotationDate = null;
  creationDate = null;
  modificationDate = null;
  doi = null;
  highlight = null;
  creator = null;
  project = null;
  data = null;
  annotationsTooltipContent: string = null;
  readonly children = new CollectionModal<FilesystemObject>([], {
    multipleSelection: true,
    sort: this.defaultSort,
  });

  filterChildren(filter: string) {
    const normalizedFilter = this.normalizeFilter(filter);
    this.children.filter = normalizedFilter.length ? (item: FilesystemObject) => {
      return this.normalizeFilter(item.name).includes(normalizedFilter);
    } : null;
  }

  getCommands(): any[] {
    switch (this.type) {
      case 'dir':
        // TODO: Convert to hash ID
        return ['/projects', this.project.projectName, 'folders', this.id];
      case 'file':
        if (this.name.slice(this.name.length - 11) === '.enrichment') {
          return ['/projects', this.project.projectName, 'enrichment-table', this.id];
        } else {
          return ['/projects', this.project.projectName, 'files', this.id];
        }
      case 'map':
        return ['/projects', this.project.projectName, 'maps', this.id];
      default:
        throw new Error(`unknown directory object type: ${this.type}`);
    }
  }

  addDataTransferData(dataTransfer: DataTransfer) {
    dataTransfer.setData('text/plain', this.name);
    dataTransfer.setData('application/lifelike-node', JSON.stringify({
      display_name: this.name,
      label: this.type === 'map' ? 'map' : 'link',
      sub_labels: [],
      data: {
        references: [{
          type: 'PROJECT_OBJECT',
          id: this.id + '',
        }],
        sources: [{
          domain: 'File Source',
          url: this.getCommands().join('/'),
        }],
      },
    } as Partial<UniversalGraphNode>));
  }

  private getId(): any {
    switch (this.type) {
      case 'dir':
        const directory = this.data as Directory;
        return directory.id;
      case 'file':
        const file = this.data as PdfFile;
        return file.file_id;
      case 'map':
        const _map = this.data as KnowledgeMap;
        return _map.hash_id;
      default:
        throw new Error(`unknown directory object type: ${this.type}`);
    }
  }

  private normalizeFilter(filter: string): string {
    return filter.trim().toLowerCase().replace(/[ _]+/g, ' ');
  }

  private defaultSort(a: FilesystemObject, b: FilesystemObject) {
    if (a.type === 'dir' && b.type !== 'dir') {
      return -1;
    } else if (a.type !== 'dir' && b.type === 'dir') {
      return 1;
    } else {
      const aDate = nullCoalesce(a.modificationDate, a.creationDate);
      const bDate = nullCoalesce(b.modificationDate, b.creationDate);

      if (aDate != null && bDate != null) {
        const aMoment = moment(aDate);
        const bMoment = moment(bDate);
        if (aMoment.isAfter(bMoment)) {
          return -1;
        } else if (aMoment.isBefore(bMoment)) {
          return 1;
        } else {
          return a.name.localeCompare(b.name);
        }
      } else if (aDate != null) {
        return -1;
      } else if (bDate != null) {
        return 1;
      } else {
        return a.name.localeCompare(b.name);
      }
    }
  }
}

export interface PathLocator {
  projectName?: string;
  directoryId?: string;
}
