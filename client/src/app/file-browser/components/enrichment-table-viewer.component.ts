import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';

import { TableHeader, TableCell, TableLink } from './generic-table.component';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { Subscription } from 'rxjs';
import {
  EnrichmentTableService,
  NCBINode,
  EnrichmentWrapper,
  GoNode,
} from '../services/enrichment-table.service';
import { ActivatedRoute } from '@angular/router';
import { PdfFilesService } from 'app/shared/services/pdf-files.service';
import { ModuleProperties } from 'app/shared/modules';

@Component({
  selector: 'app-enrichment-table-viewer',
  templateUrl: './enrichment-table-viewer.component.html',
  styleUrls: ['./enrichment-table-viewer.component.scss'],
})
export class EnrichmentTableViewerComponent implements OnInit, OnDestroy {
  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();

  // Inputs for Generic Table Component
  tableEntries: TableCell[][];
  tableHeader: TableHeader[][] = [
    // Primary headers
    [
      { name: 'Imported Gene Name', span: '1' },
      { name: 'NCBI Gene Full Name', span: '1' },
      { name: 'Regulon Data', span: '3' },
      { name: 'Uniprot Function', span: '1' },
      { name: 'String Annotation', span: '1' },
      { name: 'GO Enrichment', span: '1' },
      { name: 'Biocyc Pathways', span: '1' },
    ],
    // Secondary headers
    [
      { name: '', span: '1' },
      { name: '', span: '1' },
      { name: 'Regulator Family', span: '1' },
      { name: 'Activated By', span: '1' },
      { name: 'Repressed By', span: '1' },
      { name: '', span: '1' },
      { name: '', span: '1' },
      { name: '', span: '1' },
      { name: '', span: '1' },
    ],
  ];

  // Pagination
  currentPage: number;
  pageSize: number;
  collectionSize: number;
  currentGenes: string[];

  // condition if ecoli org
  ecoli: boolean;

  // Enrichment Table and NCBI Matching Results
  projectName: string;
  fileId: string;
  geneNames: string[];
  taxID: string;
  organism: string;
  loadTask: BackgroundTask<null, EnrichmentData>;
  loadTaskSubscription: Subscription;
  sheetname: string;
  neo4jId: number;
  ncbiNodes: NCBINode[];
  ncbiLinks: string[];
  importGenes: string[];
  unmatchedGenes: string;
  ncbiIds: number[];
  duplicateGenes: string;

  constructor(
    private readonly worksheetViewerService: EnrichmentTableService,
    private readonly filesService: PdfFilesService,
    private route: ActivatedRoute
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
      if (this.organism.slice(0, 16) !== 'Escherichia coli') {
        this.ecoli = false;
        this.tableHeader[0].splice(2, 1);
        this.tableHeader.splice(1, 1);
      } else {
        this.ecoli = true;
      }
      this.removeDuplicates(this.importGenes);
      this.currentPage = 1;
      this.pageSize = 10;
      this.collectionSize = this.importGenes.length;
      this.matchNCBINodes(this.currentPage);
    });
    this.loadTask.update();
  }

  ngOnDestroy() {
    this.loadTaskSubscription.unsubscribe();
  }

  emitModuleProperties() {
    this.modulePropertiesChange.emit({
      title: this.sheetname ? this.sheetname : 'Enrichment Table',
      fontAwesomeIcon: 'table',
    });
  }

  goToPage(page: number) {
    this.matchNCBINodes(page);
  }

  matchNCBINodes(page: number) {
    this.currentGenes = this.importGenes.slice(
      (page - 1) * this.pageSize,
      (page - 1) * this.pageSize + this.pageSize
    );
    this.worksheetViewerService
      .matchNCBINodes(this.currentGenes, this.taxID)
      .subscribe((result) => {
        this.ncbiNodes = result.map((wrapper) => wrapper.x);
        this.ncbiIds = result.map((wrapper) => wrapper.neo4jID);
        this.ncbiLinks = result.map((wrapper) => wrapper.link);
        this.getDomains();
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
  getDomains() {
    this.worksheetViewerService
      .getNCBIEnrichmentDomains(this.ncbiIds, this.taxID)
      .subscribe((result) => {
        this.tableEntries = result.map((wrapper) =>
          this.processEnrichmentNodeArray(wrapper)
        );
        for (let i = 0; i < this.ncbiNodes.length; i++) {
          this.tableEntries[i].unshift({
            text: this.ncbiNodes[i].full_name,
            singleLink: {
              link: this.ncbiLinks[i],
              linkText: 'NCBI Link',
            },
          });
          this.tableEntries[i].unshift({ text: this.ncbiNodes[i].name });
        }
        this.geneNames = this.ncbiNodes.map((node) => node.name);
        this.processUnmatchedNodes();
      });
  }

  processUnmatchedNodes() {
    const unmatchedGenes = this.currentGenes.filter(
      (gene) => !this.geneNames.includes(gene)
    );
    unmatchedGenes.forEach((gene) => {
      const cell: TableCell[] = [];
      cell.push({ text: gene, highlight: true });
      cell.push({ text: 'No match found.', highlight: true });
      const colNum = Math.max.apply(null, this.tableHeader.map(x => x.reduce((a, b) => a + parseInt(b.span, 10), 0)));
      for (let i = 0; i < colNum - 2; i++) {
        cell.push({ text: '', highlight: true });
      }
      this.tableEntries.push(cell);
    });
    this.unmatchedGenes = unmatchedGenes.join(', ');
  }

  // Process wrapper to convert domain data into string array that represents domain columns.
  processEnrichmentNodeArray(wrapper: EnrichmentWrapper): TableCell[] {
    const result: TableCell[] = [];
    if (this.ecoli) {
      if (wrapper.regulon.result !== null) {
        result.push(wrapper.regulon.result.regulator_family
          ? {
              text: wrapper.regulon.result.regulator_family,
              singleLink: { link: wrapper.regulon.link, linkText: 'Regulon Link' },
            }
          : { text: '', singleLink: {link: wrapper.regulon.link, linkText: 'Regulon Link'}});
        result.push(wrapper.regulon.result.activated_by
          ? {
              text: wrapper.regulon.result.activated_by.join('; '),
              singleLink: { link: wrapper.regulon.link, linkText: 'Regulon Link' },
            }
          : { text: '', singleLink: {link: wrapper.regulon.link, linkText: 'Regulon Link'}});
        result.push(wrapper.regulon.result.repressed_by
          ? {
              text: wrapper.regulon.result.repressed_by.join('; '),
              singleLink: { link: wrapper.regulon.link, linkText: 'Regulon Link' },
            }
          : { text: '', singleLink: {link: wrapper.regulon.link, linkText: 'Regulon Link'}});
      } else {
        for (let i = 0; i < 3; i++) {
          result.push({text: ''});
        }
      }
    }

    result.push(wrapper.uniprot.result
      ? {
          text: wrapper.uniprot.result.function,
          singleLink: { link: wrapper.uniprot.link, linkText: 'Uniprot Link' },
        }
      : { text: '' });
    result.push(wrapper.string.result
      ? {
          text: wrapper.string.result.annotation !== 'annotation not available' ? wrapper.string.result.annotation : '',
          singleLink: { link: wrapper.string.link, linkText: 'String Link' },
        }
      : { text: '' });
    result.push(wrapper.go.result
      ? {
          text: this.processGoWrapper(wrapper.go.result),
          singleLink: {
            link: wrapper.go.link + wrapper.uniprot.result.id,
            linkText: 'GO Link'
          }
        }
      : { text: '' });
    result.push(wrapper.biocyc.result
      ? wrapper.biocyc.result.pathways
        ? {
            text: wrapper.biocyc.result.pathways.join('; '),
            singleLink: {link: wrapper.biocyc.link, linkText: 'Biocyc Link'}
          }
        : {
            text: '',
            singleLink: { link: wrapper.biocyc.link, linkText: 'Biocyc Link' },
          }
      : { text: '' });
    return result;
  }

  processGoWrapper(nodeArray: GoNode[]): string {
    if (nodeArray.length > 5) {
      return nodeArray.map((node) => node.name).slice(0, 5).join(';\n') + '...';
    } else {
      return nodeArray.map((node) => node.name).slice(0, 5).join('; ');
    }
  }

  processBiocycWrapper(pathways: string[], biocycLink: string): TableLink[] {
    const result = pathways.map((pathway) => ({ link: biocycLink, linkText: pathway }));
    return result;
  }
}

export interface EnrichmentData {
  name: string;
  data: string;
}
