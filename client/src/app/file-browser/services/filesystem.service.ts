import { Injectable } from '@angular/core';
import { FilesystemObject, PathLocator } from '../models/filesystem-object';
import { PdfFilesService } from '../../shared/services/pdf-files.service';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ProgressDialog } from '../../shared/services/progress-dialog.service';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { ProjectPageService } from './project-page.service';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { PdfFile } from '../../interfaces/pdf-files.interface';
import { map } from 'rxjs/operators';

@Injectable()
export class FilesystemService {
  protected lmdbsDates = new BehaviorSubject<object>({});

  constructor(private readonly filesService: PdfFilesService,
              private readonly router: Router,
              private readonly snackBar: MatSnackBar,
              private readonly modalService: NgbModal,
              private readonly progressDialog: ProgressDialog,
              private readonly errorHandler: ErrorHandler,
              private readonly route: ActivatedRoute,
              private readonly projectPageService: ProjectPageService) {
    this.filesService.getLMDBsDates().subscribe(lmdbsDates => {
      this.lmdbsDates.next(lmdbsDates);
    });
  }

  get(locator: PathLocator): Observable<FilesystemObject> {
    return this.projectPageService.getDirectory(
        locator.projectName,
        locator.directoryId,
    ).pipe(map(result => {
      const object = new FilesystemObject();
      object.type = 'dir';
      object.locator = {
        projectName: locator.projectName,
        directoryId: result.dir.id + '',
      };
      object.directory = result.dir;
      object.path = result.path;

      const children = result.objects.map(o => {
        const child = new FilesystemObject();
        Object.assign(child, o);
        if (o.type === 'dir') {
          child.locator = {
            projectName: locator.projectName,
            directoryId: o.id,
          };
        } else {
          child.locator = object.locator;
        }
        child.directory = object.directory;
        child.path = [...result.path, result.dir];
        return child;
      });

      object.children.replace(children);

      return object;
    }));
  }

  annotate(object: FilesystemObject): Subscription {
    return this.lmdbsDates.subscribe(data => {
      object.children.items.forEach((child: FilesystemObject) => {
        if (child.type === 'file') {
          const file = child.data as PdfFile;
          child.annotationsTooltipContent = this.generateTooltipContent(file);
        }
      });
    });
  }

  private generateTooltipContent(file: PdfFile): string {
    const outdated = Array
        .from(Object.entries(this.lmdbsDates))
        .filter(([, date]: [string, string]) => Date.parse(date) >= Date.parse(file.annotations_date));
    if (outdated.length === 0) {
      return '';
    }
    return outdated.reduce(
        (tooltip: string, [name, date]: [string, string]) => `${tooltip}\n- ${name}, ${new Date(date).toDateString()}`,
        'Outdated:',
    );
  }
}
