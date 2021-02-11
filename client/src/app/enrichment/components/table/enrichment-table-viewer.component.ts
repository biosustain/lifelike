import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { BehaviorSubject, forkJoin, from, of, Subscription } from 'rxjs';
import { catchError, finalize, flatMap, map, mergeMap } from 'rxjs/operators';

import { TableCell, TableHeader } from 'app/shared/components/table/generic-table.component';
import { ModuleProperties } from 'app/shared/modules';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { DownloadService } from 'app/shared/services/download.service';

import { EnrichmentTableEditDialogComponent } from './dialog/enrichment-table-edit-dialog.component';
import { EnrichmentTableOrderDialogComponent } from './dialog/enrichment-table-order-dialog.component';
import {
  EnrichmentTableService,
  EnrichmentWrapper,
  GoNode,
  NCBINode,
  NCBIWrapper,
} from '../../services/enrichment-table.service';
import { FilesystemObject } from '../../../file-browser/models/filesystem-object';
import { FilesystemService } from '../../../file-browser/services/filesystem.service';
import { mapBlobToBuffer, mapBufferToJson } from '../../../shared/utils/files';
import { ENRICHMENT_TABLE_MIMETYPE } from '../../providers/enrichment-table.type-provider';
import { Progress } from '../../../interfaces/common-dialog.interface';
import { ProgressDialog } from '../../../shared/services/progress-dialog.service';
import { EnrichmentData } from "../visualisation/table/enrichment-table-viewer.component";
import { EnrichmentVisualisationEditDialogComponent } from "../visualisation/dialog/enrichment-visualisation-edit-dialog.component";
import { ENRICHMENT_VISUALISATION_MIMETYPE } from "../../providers/enrichment-visualisation.type-provider";


@Component({
  selector: 'app-enrichment-table-viewer',
  templateUrl: './enrichment-table-viewer.component.html',
  styleUrls: ['./enrichment-table-viewer.component.scss'],
})
export class EnrichmentTableViewerComponent implements OnInit, OnDestroy {

  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();

  // Inputs for Generic Table Component
  tableEntries: TableCell[][] = [];
  tableHeader: TableHeader[][] = [
    // Primary headers
    [
      {name: 'Imported', span: '1'},
      {name: 'Matched', span: '1'},
      {name: 'NCBI Gene Full Name', span: '1'},
    ],
  ];
  // Map where column name is mapped to first row of table header.
  headerMap: Map<string, TableHeader[]> = new Map([
    ['Regulon', [{name: 'Regulon Data', span: '3'}]],
    ['UniProt', [{name: 'Uniprot Function', span: '1'}]],
    ['String', [{name: 'String Annotation', span: '1'}]],
    ['GO', [{name: 'GO Annotation', span: '1'}]],
    ['Biocyc', [{name: 'Biocyc Pathways', span: '1'}]],
  ]);
  // Map where column name is mapped to second row of table header.
  secondHeaderMap: Map<string, TableHeader[]> = new Map([
    ['Default', [{name: '', span: '1'}, {name: '', span: '1'}, {name: '', span: '1'}]],
    ['Regulon', [{name: 'Regulator Family', span: '1'}, {name: 'Activated By', span: '1'},
      {name: 'Repressed By', span: '1'}]],
    ['UniProt', [{name: '', span: '1'}]],
    ['String', [{name: '', span: '1'}]],
    ['GO', [{name: '', span: '1'}]],
    ['Biocyc', [{name: '', span: '1'}]],
  ]);
  numDefaultHeader: number = this.tableHeader[0].length;

  // Enrichment Table and NCBI Matching Results
  domains: string[] = [];
  projectName: string;
  fileId: string;
  geneNames: string[];
  taxID: string;
  organism: string;
  loadTask: BackgroundTask<null, [FilesystemObject, EnrichmentData]>;
  loadTaskSubscription: Subscription;
  object: FilesystemObject;
  data: EnrichmentData;
  neo4jId: number;
  importGenes: string[];
  unmatchedGenes: string;
  duplicateGenes: string;
  columnOrder: string[] = [];

  scrollTopAmount: number;

  loadingData: boolean;

  constructor(protected readonly route: ActivatedRoute,
              protected readonly worksheetViewerService: EnrichmentTableService,
              protected readonly snackBar: MatSnackBar,
              protected readonly modalService: NgbModal,
              protected readonly errorHandler: ErrorHandler,
              protected readonly downloadService: DownloadService,
              protected readonly filesystemService: FilesystemService,
              protected readonly progressDialog: ProgressDialog) {
    this.projectName = this.route.snapshot.params.project_name || '';
    this.fileId = this.route.snapshot.params.file_id || '';
  }

  ngOnInit() {
    this.loadTask = new BackgroundTask(() => this.filesystemService.get(this.fileId, {
      loadContent: true,
    }).pipe(
      this.errorHandler.create({label: 'Load enrichment table'}),
      mergeMap((object: FilesystemObject) => {
        return object.contentValue$.pipe(
          mapBlobToBuffer(),
          mapBufferToJson<EnrichmentData>(),
          map((data: EnrichmentData) => [object, data] as [FilesystemObject, EnrichmentData]),
        );
      }),
    ));
    this.loadTaskSubscription = this.loadTask.results$.subscribe((result) => {
      const [object, data] = result.result;
      // parse the file content to get gene list and organism tax id and name
      this.object = object;
      this.data = data;
      this.emitModuleProperties();
      const resultArray = data.data.split('/');
      this.importGenes = resultArray[0]
        .split(',')
        .filter((gene) => gene !== '');
      this.taxID = resultArray[1];
      if (this.taxID === '562' || this.taxID === '83333') {
        this.taxID = '511145';
      } else if (this.taxID === '4932') {
        this.taxID = '559292';
      }
      this.organism = resultArray[2];
      // parse for column order/domain input
      if (resultArray.length > 3) {
        if (resultArray[3] !== '') {
          this.domains = resultArray[3].split(',');
          this.columnOrder = resultArray[3].split(',');
          if (this.columnOrder.includes('Regulon')) {
            const index = this.columnOrder.indexOf('Regulon');
            this.columnOrder.splice(index + 1, 0, 'Regulon 3');
            this.columnOrder.splice(index + 1, 0, 'Regulon 2');
          }
        }
      } else {
        // Default view for existing tables
        this.domains = ['Regulon', 'UniProt', 'String', 'GO', 'Biocyc'];
        this.columnOrder = ['Regulon', 'Regulon 2', 'Regulon 3', 'UniProt', 'String', 'GO', 'Biocyc'];
      }
      this.initializeHeaders();
      this.removeDuplicates(this.importGenes);
      this.matchNCBINodes();
    });
    this.loadTask.update();
  }

  ngOnDestroy() {
    this.loadTaskSubscription.unsubscribe();
  }

  scrollTop() {
    this.scrollTopAmount = 0;
  }

  onTableScroll(e) {
    this.scrollTopAmount = e.target.scrollTop;
  }

  // Start of Download for CSV section.

  /**
   * Function to that returns all data without changing current table view.
   */
  loadAllEntries(): Promise<TableCell[][]> {
    return this.worksheetViewerService
      .matchNCBINodes(this.importGenes, this.taxID)
      .pipe(
        flatMap(matched => forkJoin(
          [matched.map((wrapper) => wrapper.s)],
          [matched.map((wrapper) => wrapper.x)],
          [matched.map((wrapper) => wrapper.link)],
          [matched.map((wrapper) => wrapper.neo4jID)],
          this.worksheetViewerService.getNCBIEnrichmentDomains(
            matched.map((wrapper) => wrapper.neo4jID), this.taxID),
        )),
        map(([synonyms, ncbiNodes, ncbiLinks, ncbiIds, domains]) => {
          const tableEntries = domains.map((wrapper) =>
            this.processEnrichmentNodeArray(wrapper, ncbiNodes, ncbiIds),
          );
          for (let i = 0; i < ncbiNodes.length; i++) {
            tableEntries[i].unshift({
              text: ncbiNodes[i].full_name,
              singleLink: {
                link: ncbiLinks[i],
                linkText: 'NCBI Link',
              },
            });
            tableEntries[i].unshift({text: ncbiNodes[i].name});
            tableEntries[i].unshift({text: synonyms[i].name});
          }
          const geneNames = synonyms.map((node) => node.name);
          const unmatchedGenes = this.importGenes.filter(
            (gene) => !geneNames.includes(gene),
          );
          unmatchedGenes.forEach((gene) => {
            const cell: TableCell[] = [];
            cell.push({text: gene, highlight: true});
            cell.push({text: 'No match found.', highlight: true});
            const colNum = Math.max.apply(
              null,
              this.tableHeader.map((x) =>
                x.reduce((a, b) => a + parseInt(b.span, 10), 0),
              ),
            );
            for (let i = 0; i < colNum - 2; i++) {
              cell.push({text: '', highlight: true});
            }
            tableEntries.push(cell);
          });
          return tableEntries;
        }),
      ).toPromise();
  }

  /**
   * Convert an array representing a row for CSV formatting.
   * @param row array that represents a row in a table
   * @returns string that represents row in CSV format.
   */
  processRowCSV(row: string | any[]): string {
    let finalVal = '';
    for (let j = 0; j < row.length; j++) {
      let innerValue = row[j] === null ? '' : row[j].toString();
      if (row[j] instanceof Date) {
        innerValue = row[j].toLocaleString();
      }
      let result = innerValue.replace(/"/g, '""');
      if (result.search(/("|,|\n)/g) >= 0) {
        result = '"' + result + '"';
      }
      if (j > 0) {
        finalVal += ',';
      }
      finalVal += result;
    }
    return finalVal + '\n';
  }

  createVisualisation() {
    const dialogRef = this.modalService.open(EnrichmentVisualisationEditDialogComponent);
    dialogRef.componentInstance.title = 'New Enrichment Visualisation Parameters';
    dialogRef.componentInstance.submitButtonLabel = 'Next';
    const object = new FilesystemObject();
    object.filename = 'Untitled Enrichment Visualisation';
    object.mimeType = ENRICHMENT_VISUALISATION_MIMETYPE;
    object.parent = this.object.parent;
    dialogRef.componentInstance.object = object;
    dialogRef.componentInstance.data = {
      domains: this.domains,
      genes: this.importGenes,
      organism: this.organism
    };

    return dialogRef.result.then((parameters) => {
      return this.objectCreationService.openCreateDialog(object, {
        title: 'Name the Enrichment Visualisation',
        request: {
          contentValue: new Blob([JSON.stringify({parameters, cachedResults:{}})]),
        }
      });
    });
  }

  /**
   * Load all data, convert to CSV format and provide download.
   */
  downloadAsCSV() {
    // TODO: Implement this as an export format in the filesystem API
    this.downloadService.requestDownload(
      this.object.filename,
      () => from(this.loadAllEntries()).pipe(
        mergeMap(entries => {
          const stringEntries = this.convertEntriesToString(entries);
          let csvFile = '';
          stringEntries.forEach(entry => csvFile += this.processRowCSV(entry));
          return of(csvFile);
        }),
      ),
      'application/csv',
      '.csv',
    );
  }

  /**
   * Convert entire table to string.
   * @param entries table entries in TableCell format
   * @returns 2d string array that represents table.
   */
  convertEntriesToString(entries: TableCell[][]): string[][] {
    const result = [];
    this.tableHeader.forEach(row => {
      const rowString = [];
      row.forEach(header => {
        rowString.push(header.name);
        if (header.span !== '1') {
          for (let i = 1; i < parseInt(header.span, 10); i++) {
            rowString.push('');
          }
        }
      });
      result.push(rowString);
    });
    entries.forEach(row => {
      const rowString = [];
      row.forEach(entry => {
        let entryString = entry.text;
        if (typeof entry.singleLink !== 'undefined') {
          entryString += '\n' + entry.singleLink.link;
        }
        if (typeof entry.multiLink !== 'undefined') {
          entry.multiLink.forEach(link => entryString += '\n' + link.link);
        }
        rowString.push(entryString);
      });
      result.push(rowString);
    });
    return result;
  }

  // End of Download for CSV section.

  // Start of changing enrichment params section.

  /**
   * Opens EnrichmentTableOrderDialog that gives new column order.
   */
  openOrderDialog(): Promise<any> {
    const dialogRef = this.modalService.open(EnrichmentTableOrderDialogComponent);
    dialogRef.componentInstance.domains = [...this.domains];
    return dialogRef.result.then((result) => {
      if (this.domains !== result) {
        this.reorderEntries(result);
      }
    }, () => {
    });
  }

  /**
   * Change current table entries to follow new column order.
   * @param order new column order.
   */
  reorderEntries(order: string[]) {
    const newEntries = [];
    this.tableEntries.forEach(row => {
      const newRow = [];
      for (let i = 0; i < this.numDefaultHeader; i++) {
        newRow[i] = row[i];
      }
      const newOrder = [...order];
      const newDomains = [...this.domains];

      // Regulon column has three sub columns that need to be updated.
      if (newOrder.includes('Regulon')) {
        newOrder.splice(newOrder.indexOf('Regulon') + 1, 0, 'Regulon 1');
        newOrder.splice(newOrder.indexOf('Regulon') + 2, 0, 'Regulon 2');
        newDomains.splice(newDomains.indexOf('Regulon') + 1, 0, 'Regulon 1');
        newDomains.splice(newDomains.indexOf('Regulon') + 2, 0, 'Regulon 2');
      }

      newOrder.forEach(domain =>
        newRow[newOrder.indexOf(domain) + this.numDefaultHeader] =
          row[newDomains.indexOf(domain) + this.numDefaultHeader]);
      newEntries.push(newRow);
    });
    this.tableEntries = newEntries;
    this.domains = order;
    this.columnOrder = [...order];
    if (this.columnOrder.includes('Regulon')) {
      const index = this.columnOrder.indexOf('Regulon');
      this.columnOrder.splice(index + 1, 0, 'Regulon 3');
      this.columnOrder.splice(index + 1, 0, 'Regulon 2');
    }
    this.initializeHeaders();
  }

  /**
   * Edit enrichment params (essentially the file content) and updates table.
   */
  openEnrichmentTableEditDialog(): Promise<any> {
    const dialogRef = this.modalService.open(EnrichmentTableEditDialogComponent);
    dialogRef.componentInstance.object = this.object;
    dialogRef.componentInstance.data = this.data;
    return dialogRef.result.then((result: EnrichmentData) => {
      const contentValue = new Blob([JSON.stringify(result)], {
        type: ENRICHMENT_TABLE_MIMETYPE,
      });

      const progressDialogRef = this.progressDialog.display({
        title: `Saving Parameters`,
        progressObservable: new BehaviorSubject<Progress>(new Progress({
          status: 'Updating enrichment table parameters...',
        })),
      });

      // Push to backend to save
      this.filesystemService.save([this.object.hashId], {
        contentValue,
      })
        .pipe(
          finalize(() => progressDialogRef.close()),
          this.errorHandler.create({label: 'Edit enrichment table'}),
        )
        .subscribe(() => {
          this.emitModuleProperties();
          this.snackBar.open('Enrichment table updated.', null, {
            duration: 2000,
          });
          this.tableEntries = [];
          this.loadTask.update();
        });
    }, () => {
    });
  }

  // End of changing enrichment params section.

  emitModuleProperties() {
    this.modulePropertiesChange.emit({
      title: this.object ? this.object.filename : 'Enrichment Table',
      fontAwesomeIcon: 'table',
    });
  }

  /**
   * Change the table headers based on column order and domain input.
   */
  initializeHeaders() {
    this.tableHeader = [
      [
        {name: 'Imported', span: '1'},
        {name: 'Matched', span: '1'},
        {name: 'NCBI Gene Full Name', span: '1'},
      ],
    ];
    if (this.domains.includes('Regulon')) {
      this.tableHeader[1] = this.secondHeaderMap.get('Default');
    }
    this.domains.forEach((domain) => {
      this.tableHeader[0] = this.tableHeader[0].concat(this.headerMap.get(domain));
      if (this.domains.includes('Regulon')) {
        this.tableHeader[1] = this.tableHeader[1].concat(this.secondHeaderMap.get(domain));
      }
    });
  }

  /**
   *  Match list of inputted gene names to NCBI nodes with name stored in Neo4j.
   */
  matchNCBINodes() {
    this.loadingData = true;
    this.worksheetViewerService
      .matchNCBINodes(this.importGenes, this.taxID)
      .pipe(
        catchError((error) => {
          this.snackBar.open(`Unable to load entries.`, 'Close', {
            duration: 5000,
          });
          this.loadingData = false;
          return error;
        }),
        this.errorHandler.create({label: 'Match NCBI nodes'}),
      )
      .subscribe((result: NCBIWrapper[]) => {
        this.getDomains(result, this.importGenes);
      });
  }

  /**
   * Remove any duplicates from the import gene list and populate duplicate list
   * @param arr string of gene names
   */
  removeDuplicates(arr: string[]) {
    const duplicateArray: string[] = [];
    const uniqueArray: string[] = [];
    for (let i = 0; i < arr.length; i++) {
      if (arr.indexOf(arr[i]) !== i) {
        duplicateArray.push(arr[i]);
      } else {
        uniqueArray.push(arr[i]);
      }
    }
    this.importGenes = uniqueArray;
    this.duplicateGenes = duplicateArray.join(', ');
  }

  /**
   * Using node ids of matched NCBI nodes, get data from enrichment domains and add
   * data to table entries.
   * @param result result from matching to NCBI nodes
   * @param currentGenes list of gene names used to process unmatched genes.
   */
  getDomains(result: NCBIWrapper[], currentGenes: string[]) {
    const synonyms = result.map((wrapper) => wrapper.s.name);
    const ncbiNodes = result.map((wrapper) => wrapper.x);
    const ncbiIds = result.map((wrapper) => wrapper.neo4jID);
    const ncbiLinks = result.map((wrapper) => wrapper.link);
    this.worksheetViewerService
      .getNCBIEnrichmentDomains(ncbiIds, this.taxID)
      .pipe(
        catchError((error) => {
          this.snackBar.open(`Unable to load entries.`, 'Close', {
            duration: 5000,
          });
          this.loadingData = false;
          return error;
        }),
        this.errorHandler.create({label: 'Get domains for enrichment table'}),
      )
      .subscribe((domainResult: EnrichmentWrapper[]) => {
        let newEntries = domainResult.map((wrapper) =>
          this.processEnrichmentNodeArray(wrapper, ncbiNodes, ncbiIds),
        );
        // Add ncbi and imported gene name columns to relevant columns (left of domains)
        for (let i = 0; i < ncbiNodes.length; i++) {
          newEntries[i].unshift({
            text: ncbiNodes[i].full_name,
            singleLink: {
              link: ncbiLinks[i],
              linkText: 'NCBI Link',
            },
          });
          newEntries[i].unshift({text: ncbiNodes[i].name});
          newEntries[i].unshift({text: synonyms[i]});
        }
        newEntries = newEntries.concat(this.processUnmatchedNodes(synonyms, currentGenes));
        this.tableEntries = this.tableEntries.concat(newEntries);
        this.loadingData = false;
      });
  }

  /**
   * Process matched genes to add all unmatched gene names to bottom of table.
   * @param synonyms matched gene names
   * @param currentGenes initial list of gene names
   */
  processUnmatchedNodes(synonyms: string[], currentGenes: string[]): TableCell[][] {
    this.geneNames = synonyms;
    const unmatchedGenes = currentGenes.filter(
      (gene) => !this.geneNames.includes(gene),
    );
    const result = [];
    unmatchedGenes.forEach((gene) => {
      const cell: TableCell[] = [];
      cell.push({text: gene, highlight: true});
      cell.push({text: 'No match found.', highlight: true});
      const colNum = Math.max.apply(
        null,
        this.tableHeader.map((x) =>
          x.reduce((a, b) => a + parseInt(b.span, 10), 0),
        ),
      );
      for (let i = 0; i < colNum - 2; i++) {
        cell.push({text: '', highlight: true});
      }
      result.push(cell);
    });
    return result;
  }

  /**
   * Process wrapper to convert domain data into string array that represents domain columns.
   * Uses this.domains property (domain input) to determine whether to display in table.
   * Uses this.columnOrder to determine which column/index to place in.
   * If certain properties of domain (result or some property on result) are not defined, add TableCell with empty string.
   * TODO: Could make more efficient by adding domain as input to domain get request.
   * @param wrapper data returned from get domains request
   * @param ncbiNodes matched ncbi data
   * @param ncbiIds matched ncbi ids
   * @returns table entries
   */
  processEnrichmentNodeArray(wrapper: EnrichmentWrapper, ncbiNodes: NCBINode[], ncbiIds: number[]): TableCell[] {
    const result: TableCell[] = [];
    if (this.domains.includes('Regulon')) {
      if (wrapper.regulon.result !== null) {
        result[this.columnOrder.indexOf('Regulon')] = (
          wrapper.regulon.result.regulator_family
            ? {
              text: wrapper.regulon.result.regulator_family,
              singleLink: {
                link: wrapper.regulon.link,
                linkText: 'Regulon Link',
              },
            }
            : {
              text: '',
              singleLink: {
                link: wrapper.regulon.link,
                linkText: 'Regulon Link',
              },
            }
        );
        result[this.columnOrder.indexOf('Regulon 2')] = (
          wrapper.regulon.result.activated_by
            ? {
              text: wrapper.regulon.result.activated_by.join('; '),
              singleLink: {
                link: wrapper.regulon.link,
                linkText: 'Regulon Link',
              },
            }
            : {
              text: '',
              singleLink: {
                link: wrapper.regulon.link,
                linkText: 'Regulon Link',
              },
            }
        );
        result[this.columnOrder.indexOf('Regulon 3')] = (
          wrapper.regulon.result.repressed_by
            ? {
              text: wrapper.regulon.result.repressed_by.join('; '),
              singleLink: {
                link: wrapper.regulon.link,
                linkText: 'Regulon Link',
              },
            }
            : {
              text: '',
              singleLink: {
                link: wrapper.regulon.link,
                linkText: 'Regulon Link',
              },
            }
        );
      } else {
        for (let i = 0; i < 3; i++) {
          result[this.columnOrder.indexOf('Regulon') + i] = ({text: ''});
        }
      }
    }
    if (this.domains.includes('UniProt')) {
      result[this.columnOrder.indexOf('UniProt')] = (
        wrapper.uniprot.result
          ? {
            text: wrapper.uniprot.result.function,
            singleLink: {
              link: wrapper.uniprot.link,
              linkText: 'Uniprot Link',
            },
          }
          : {text: ''}
      );
    }
    if (this.domains.includes('String')) {
      result[this.columnOrder.indexOf('String')] = (
        wrapper.string.result
          ? {
            text:
              wrapper.string.result.annotation !== 'annotation not available'
                ? wrapper.string.result.annotation
                : '',
            singleLink: wrapper.string.result.id
              ? {
                link: wrapper.string.link + wrapper.string.result.id,
                linkText: 'String Link',
              }
              : wrapper.biocyc.result.biocyc_id
                ? {
                  link: wrapper.string.link + wrapper.biocyc.result.biocyc_id,
                  linkText: 'String Link',
                }
                : null,
          }
          : {text: ''}
      );
    }
    if (this.domains.includes('GO')) {
      result[this.columnOrder.indexOf('GO')] = (
        wrapper.go.result
          ? {
            text: this.processGoWrapper(wrapper.go.result),
            singleLink: wrapper.uniprot.result
              ? {
                link: wrapper.go.link + wrapper.uniprot.result.id,
                linkText: 'GO Link',
              }
              : {
                link:
                  'http://amigo.geneontology.org/amigo/search/annotation?q=' +
                  ncbiNodes[ncbiIds.indexOf(wrapper.node_id)].name,
                linkText: 'GO Link',
              },
          }
          : {text: ''}
      );
    }
    if (this.domains.includes('Biocyc')) {
      result[this.columnOrder.indexOf('Biocyc')] = (
        wrapper.biocyc.result
          ? wrapper.biocyc.result.pathways
          ? {
            text: wrapper.biocyc.result.pathways.join('; '),
            singleLink: {
              link: wrapper.biocyc.link,
              linkText: 'Biocyc Link',
            },
          }
          : {
            text: '',
            singleLink: {
              link: wrapper.biocyc.link,
              linkText: 'Biocyc Link',
            },
          }
          : {text: ''}
      );
    }
    return result;
  }

  processGoWrapper(nodeArray: GoNode[]): string {
    if (nodeArray.length > 5) {
      return (
        nodeArray
          .map((node) => node.name)
          .slice(0, 5)
          .join('; ') + '...'
      );
    } else {
      return nodeArray
        .map((node) => node.name)
        .slice(0, 5)
        .join('; ');
    }
  }

  dragStarted(event: DragEvent) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    this.object.addDataTransferData(dataTransfer);
  }
}
