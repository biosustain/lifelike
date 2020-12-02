import {
  Component,
  OnInit,
  OnDestroy,
  Output,
  EventEmitter,
} from '@angular/core';

import { MatSnackBar } from '@angular/material/snack-bar';
import { TableHeader, TableCell, TableLink } from 'app/shared/components/table/generic-table.component';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { Subscription, forkJoin } from 'rxjs';
import {
  EnrichmentTableService,
  NCBINode,
  EnrichmentWrapper,
  GoNode,
  Synonym,
  NCBIWrapper,
} from '../services/enrichment-table.service';
import { ActivatedRoute } from '@angular/router';
import { PdfFilesService } from 'app/shared/services/pdf-files.service';
import { ModuleProperties } from 'app/shared/modules';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { EnrichmentTableOrderDialogComponent } from './enrichment-table-order-dialog.component';
import { EnrichmentTableEditDialogComponent } from './enrichment-table-edit-dialog.component';
import {flatMap, map } from 'rxjs/operators';

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
      { name: 'Imported', span: '1' },
      { name: 'Matched', span: '1'},
      { name: 'NCBI Gene Full Name', span: '1' },
    ]
  ];
  headerMap: Map<string, TableHeader[]> = new Map([
    ['Regulon', [{ name: 'Regulon Data', span: '3' }]],
    ['UniProt', [{ name: 'Uniprot Function', span: '1' }]],
    ['String', [{ name: 'String Annotation', span: '1' }]],
    ['GO', [{ name: 'GO Annotation', span: '1' }]],
    ['Biocyc', [{ name: 'Biocyc Pathways', span: '1' }]],
  ]);
  secondHeaderMap: Map<string, TableHeader[]> = new Map([
    ['Default', [{ name: '', span: '1' }, { name: '', span: '1' }, { name: '', span: '1' }]],
    ['Regulon', [{ name: 'Regulator Family', span: '1' }, { name: 'Activated By', span: '1' },
    { name: 'Repressed By', span: '1' }]],
    ['UniProt', [{ name: '', span: '1' }]],
    ['String', [{ name: '', span: '1' }]],
    ['GO', [{ name: '', span: '1' }]],
    ['Biocyc', [{ name: '', span: '1' }]],
  ]);

  // Pagination
  currentPage: number;
  pageSize: number;
  collectionSize: number;
  currentGenes: string[];
  morePages: boolean;
  numDefaultHeader: number = this.tableHeader[0].length;

  // Enrichment Table and NCBI Matching Results
  domains: string[] = [];
  projectName: string;
  fileId: string;
  geneNames: string[];
  taxID: string;
  organism: string;
  loadTask: BackgroundTask<null, EnrichmentData>;
  loadTaskSubscription: Subscription;
  sheetname: string;
  neo4jId: number;
  importGenes: string[];
  unmatchedGenes: string;
  duplicateGenes: string;
  columnOrder: string[] = [];

  constructor(
    private readonly worksheetViewerService: EnrichmentTableService,
    private readonly filesService: PdfFilesService,
    private route: ActivatedRoute,
    readonly snackBar: MatSnackBar,
    private readonly modalService: NgbModal,
  ) {
    this.projectName = this.route.snapshot.params.project_name || '';
    this.fileId = this.route.snapshot.params.file_id || '';
  }

  ngOnInit() {
    this.loadTask = new BackgroundTask(() =>
      this.filesService.getEnrichmentData(this.projectName, this.fileId)
    );
    this.loadTaskSubscription = this.loadTask.results$.subscribe((result) => {
      // digest the file content to get gene list and organism tax id and name
      this.sheetname = result.result.name.slice(0, -11);
      this.emitModuleProperties();
      const resultArray = result.result.data.split('/');
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
      this.currentPage = 1;
      this.pageSize = 10;
      this.collectionSize = this.importGenes.length;
      if (this.currentPage < Math.ceil(this.collectionSize / this.pageSize)) {
        this.morePages = true;
      }
      this.matchNCBINodes(this.currentPage);
    });
    this.loadTask.update();
  }

  ngOnDestroy() {
    this.loadTaskSubscription.unsubscribe();
  }

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
          matched.map((wrapper) => wrapper.neo4jID), this.taxID)
      )),
      map(([synonyms, ncbiNodes, ncbiLinks, ncbiIds, domains]) => {
        const tableEntries = domains.map((wrapper) =>
          this.processEnrichmentNodeArray(wrapper, ncbiNodes, ncbiIds)
        );
        for (let i = 0; i < ncbiNodes.length; i++) {
          tableEntries[i].unshift({
            text: ncbiNodes[i].full_name,
            singleLink: {
              link: ncbiLinks[i],
              linkText: 'NCBI Link',
            },
          });
          tableEntries[i].unshift({ text: ncbiNodes[i].name });
          tableEntries[i].unshift({ text: synonyms[i].name });
        }
        const geneNames = synonyms.map((node) => node.name);
        const unmatchedGenes = this.importGenes.filter(
          (gene) => !geneNames.includes(gene)
        );
        unmatchedGenes.forEach((gene) => {
          const cell: TableCell[] = [];
          cell.push({ text: gene, highlight: true });
          cell.push({ text: 'No match found.', highlight: true });
          const colNum = Math.max.apply(
            null,
            this.tableHeader.map((x) =>
              x.reduce((a, b) => a + parseInt(b.span, 10), 0)
            )
          );
          for (let i = 0; i < colNum - 2; i++) {
            cell.push({ text: '', highlight: true });
          }
          tableEntries.push(cell);
        });
        return tableEntries;
      })
    ).toPromise();
  }

  processRowCSV(row) {
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

  downloadAsCSV() {
    this.loadAllEntries().then(entries => {
      const stringEntries = this.convertEntriesToString(entries);
      let csvFile = '';
      stringEntries.forEach(entry => csvFile += this.processRowCSV(entry));
      const blob = new Blob([csvFile], { type: 'text/csv;charset=utf-8;' });
      if (navigator.msSaveBlob) { // IE 10+
          navigator.msSaveBlob(blob, this.sheetname);
      } else {
          const link = document.createElement('a');
          if (link.download !== undefined) { // feature detection
              // Browsers that support HTML5 download attribute
              const url = URL.createObjectURL(blob);
              link.setAttribute('href', url);
              link.setAttribute('download', this.sheetname);
              link.style.visibility = 'hidden';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
          }
      }
      });
  }

  onTableScroll(e) {
    const tableViewHeight = e.target.offsetHeight;
    const tableScrollHeight = e.target.scrollHeight;
    const scrollLocation = e.target.scrollTop;

    // If the user has scrolled within 10px of the bottom, add more data
    const buffer = 10;
    const limit = tableScrollHeight - tableViewHeight - buffer;
    if (scrollLocation > limit && this.currentPage < Math.ceil(this.collectionSize / this.pageSize)) {
      this.currentPage += 1;
      this.goToPage(this.currentPage);
    }
  }

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

  openOrderDialog(): Promise<any> {
    const dialogRef = this.modalService.open(EnrichmentTableOrderDialogComponent);
    dialogRef.componentInstance.domains = [...this.domains];
    return dialogRef.result.then((result) => {
      if (this.domains !== result) {
        this.reorderEntries(result);
      }
    }, () => {});
  }

  reorderEntries(order: string[]) {
    const newEntries = [];
    this.tableEntries.forEach(row => {
      const newRow = [];
      for (let i = 0; i < this.numDefaultHeader; i++) {
        newRow[i] = row[i];
      }
      const newOrder = [...order];
      newOrder.splice(newOrder.indexOf('Regulon') + 1, 0, 'Regulon 1');
      newOrder.splice(newOrder.indexOf('Regulon') + 2, 0, 'Regulon 2');

      const newDomains = [...this.domains];
      newDomains.splice(newDomains.indexOf('Regulon') + 1, 0, 'Regulon 1');
      newDomains.splice(newDomains.indexOf('Regulon') + 2, 0, 'Regulon 2');

      newOrder.forEach(domain =>
        newRow[newOrder.indexOf(domain) + this.numDefaultHeader] =
        row[newDomains.indexOf(domain) + this.numDefaultHeader]);
      newEntries.push(newRow);
    });
    this.tableEntries = newEntries;
    this.domains = order;
    this.columnOrder = [ ...order];
    if (this.columnOrder.includes('Regulon')) {
      const index = this.columnOrder.indexOf('Regulon');
      this.columnOrder.splice(index + 1, 0, 'Regulon 3');
      this.columnOrder.splice(index + 1, 0, 'Regulon 2');
    }
    this.initializeHeaders();
  }

  openEnrichmentTableEditDialog(): Promise<any> {
    const dialogRef = this.modalService.open(EnrichmentTableEditDialogComponent);
    dialogRef.componentInstance.fileId = this.fileId;
    dialogRef.componentInstance.projectName = this.projectName;
    return dialogRef.result.then((result) => {
      const enrichmentData = result.entitiesList.replace(/[\/\n\r]/g, ',') + '/' + result.organism + '/' + result.domainsList.join(',');
      return this.filesService.editGeneList(
          this.projectName,
          this.fileId,
          enrichmentData,
          result.name,
          result.description,
      ).subscribe((status) => {
        this.snackBar.open(`Enrichment table updated.`, 'Close', {
          duration: 5000,
        });
        this.loadTask.update();
      });
    }, () => {});
  }

  emitModuleProperties() {
    this.modulePropertiesChange.emit({
      title: this.sheetname ? this.sheetname : 'Enrichment Table',
      fontAwesomeIcon: 'table',
    });
  }

  initializeHeaders() {
    this.tableHeader = [
      [
        { name: 'Imported', span: '1' },
        { name: 'Matched', span: '1'},
        { name: 'NCBI Gene Full Name', span: '1' },
      ]
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

  goToPage(page: number) {
    this.matchNCBINodes(page);
  }

  matchNCBINodes(page: number) {
    const currentGenes = this.importGenes.slice(
      (page - 1) * this.pageSize,
      (page - 1) * this.pageSize + this.pageSize
    );
    this.worksheetViewerService
      .matchNCBINodes(currentGenes, this.taxID)
      .subscribe((result) => {
        this.getDomains(result, currentGenes);
      });
  }

  // Remove any duplicates from the import gene list and populate duplicate list
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

  // Get data from enrichment domains.
  getDomains(result: NCBIWrapper[], currentGenes: string[]) {
    const synonyms = result.map((wrapper) => wrapper.s);
    const ncbiNodes = result.map((wrapper) => wrapper.x);
    const ncbiIds = result.map((wrapper) => wrapper.neo4jID);
    const ncbiLinks = result.map((wrapper) => wrapper.link);
    this.worksheetViewerService
      .getNCBIEnrichmentDomains(ncbiIds, this.taxID)
      .subscribe((domainResult) => {
        let newEntries = domainResult.map((wrapper) =>
          this.processEnrichmentNodeArray(wrapper, ncbiNodes, ncbiIds)
        );
        for (let i = 0; i < ncbiNodes.length; i++) {
          newEntries[i].unshift({
            text: ncbiNodes[i].full_name,
            singleLink: {
              link: ncbiLinks[i],
              linkText: 'NCBI Link',
            },
          });
          newEntries[i].unshift({ text: ncbiNodes[i].name });
          newEntries[i].unshift({ text: synonyms[i].name });
        }
        newEntries = newEntries.concat(this.processUnmatchedNodes(synonyms, currentGenes));
        this.tableEntries = this.tableEntries.concat(newEntries);
      });
  }

  processUnmatchedNodes(synonyms: Synonym[], currentGenes: string[]): TableCell[][] {
    this.geneNames = synonyms.map((node) => node.name);
    const unmatchedGenes = currentGenes.filter(
      (gene) => !this.geneNames.includes(gene)
    );
    const result = [];
    unmatchedGenes.forEach((gene) => {
      const cell: TableCell[] = [];
      cell.push({ text: gene, highlight: true });
      cell.push({ text: 'No match found.', highlight: true });
      const colNum = Math.max.apply(
        null,
        this.tableHeader.map((x) =>
          x.reduce((a, b) => a + parseInt(b.span, 10), 0)
        )
      );
      for (let i = 0; i < colNum - 2; i++) {
        cell.push({ text: '', highlight: true });
      }
      result.push(cell);
    });
    return result;
  }

  // Process wrapper to convert domain data into string array that represents domain columns.
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
          result[this.columnOrder.indexOf('Regulon') + i] = ({ text: '' });
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
          : { text: '' }
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
          : { text: '' }
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
          : { text: '' }
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
          : { text: '' }
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

  processBiocycWrapper(pathways: string[], biocycLink: string): TableLink[] {
    const result = pathways.map((pathway) => ({
      link: biocycLink,
      linkText: pathway,
    }));
    return result;
  }
}

export interface EnrichmentData {
  name: string;
  data: string;
}
