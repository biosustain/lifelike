import {
  Component,
  OnInit,
  OnDestroy,
  Output,
  EventEmitter,
} from '@angular/core';

import { TableHeader, TableCell, TableLink } from 'app/shared/components/table/generic-table.component';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { Subscription } from 'rxjs';
import {
  EnrichmentTableService,
  NCBINode,
  EnrichmentWrapper,
  GoNode,
  Synonym,
} from '../../../services/enrichment-table.service';
import { ActivatedRoute } from '@angular/router';
import { PdfFilesService } from 'app/shared/services/pdf-files.service';
import { ModuleProperties } from 'app/shared/modules';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { EnrichmentTableOrderDialogComponent } from './enrichment-table-order-dialog.component';

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
      { name: 'Matched Gene Name', span: '1'},
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
  synonyms: Synonym[];
  ncbiNodes: NCBINode[];
  ncbiLinks: string[];
  importGenes: string[];
  unmatchedGenes: string;
  ncbiIds: number[];
  duplicateGenes: string;
  columnOrder: string[] = [];

  constructor(
    private readonly worksheetViewerService: EnrichmentTableService,
    private readonly filesService: PdfFilesService,
    private route: ActivatedRoute,
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
      this.matchNCBINodes(this.currentPage);
    });
    this.loadTask.update();
  }

  ngOnDestroy() {
    this.loadTaskSubscription.unsubscribe();
  }

  openOrderDialog(): Promise<any> {
    const dialogRef = this.modalService.open(EnrichmentTableOrderDialogComponent);
    dialogRef.componentInstance.domains = this.domains;
    return dialogRef.result.then((result) => {
      this.domains = result;
      this.columnOrder = [ ...result];
      if (this.columnOrder.includes('Regulon')) {
        const index = this.columnOrder.indexOf('Regulon');
        this.columnOrder.splice(index + 1, 0, 'Regulon 3');
        this.columnOrder.splice(index + 1, 0, 'Regulon 2');
      }
      this.tableHeader = [
        // Primary headers
        [
          { name: 'Imported Gene Name', span: '1' },
          { name: 'Matched Gene Name', span: '1'},
          { name: 'NCBI Gene Full Name', span: '1' },
        ]
      ];
      this.initializeHeaders();
      this.matchNCBINodes(this.currentPage);

    }, () => {});
  }

  emitModuleProperties() {
    this.modulePropertiesChange.emit({
      title: this.sheetname ? this.sheetname : 'Enrichment Table',
      fontAwesomeIcon: 'table',
    });
  }

  initializeHeaders() {
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
    this.currentGenes = this.importGenes.slice(
      (page - 1) * this.pageSize,
      (page - 1) * this.pageSize + this.pageSize
    );
    this.worksheetViewerService
      .matchNCBINodes(this.currentGenes, this.taxID)
      .subscribe((result) => {
        this.synonyms = result.map((wrapper) => wrapper.s);
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
          this.tableEntries[i].unshift({ text: this.synonyms[i].name });
        }
        this.geneNames = this.synonyms.map((node) => node.name);
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
      const colNum = Math.max.apply(
        null,
        this.tableHeader.map((x) =>
          x.reduce((a, b) => a + parseInt(b.span, 10), 0)
        )
      );
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
                      this.ncbiNodes[this.ncbiIds.indexOf(wrapper.node_id)].name,
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
