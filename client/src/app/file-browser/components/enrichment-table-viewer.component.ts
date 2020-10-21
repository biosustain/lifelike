import { Component, OnInit, OnDestroy } from '@angular/core';

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

@Component({
  selector: 'app-enrichment-table-viewer',
  templateUrl: './enrichment-table-viewer.component.html',
  styleUrls: ['./enrichment-table-viewer.component.scss'],
})
export class EnrichmentTableViewerComponent implements OnInit, OnDestroy {
  // Inputs for Generic Table Component
  tableEntries: TableCell[][];
  tableHeader: TableHeader[][] = [
    // Primary headers
    [
      { name: 'Imported Gene Name', span: '1' },
      { name: 'NCBI Gene Full Name', span: '1' },
      { name: 'Regulon Gene Product Name', span: '1' },
      { name: 'Uniprot Function', span: '1' },
      { name: 'String Annotation', span: '1' },
      { name: 'Go Enrichment', span: '3' },
      { name: 'Biocyc', span: '1' },
    ],
    // Secondary headers
    [
      { name: '', span: '1' },
      { name: '', span: '1' },
      { name: '', span: '1' },
      { name: '', span: '1' },
      { name: '', span: '1' },
      { name: 'Molecular Function', span: '1' },
      { name: 'Biological Process', span: '1' },
      { name: 'Cellular Component', span: '1' },
      { name: '', span: '1' },
    ],
  ];

  // Pagination
  currentPage: number;
  pageSize: number;
  collectionSize: number;
  currentGenes: string[];

  // Enrichment Table and NCBI Matching Results
  projectName: string;
  fileId: string;
  geneNames: string[];
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
      // digest the file content to get gene list and organism
      this.sheetname = result.result.name.slice(0, -11);
      const resultArray = result.result.data.split('/');
      this.importGenes = resultArray[0]
        .split(',')
        .filter((gene) => gene !== '');
      this.organism = resultArray[1];
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

  goToPage(page: number) {
    this.matchNCBINodes(page);
  }

  matchNCBINodes(page: number) {
    this.currentGenes = this.importGenes.slice(
      (page - 1) * this.pageSize,
      (page - 1) * this.pageSize + this.pageSize
    );
    this.worksheetViewerService
      .matchNCBINodes(this.currentGenes, this.organism)
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
      .getNCBIEnrichmentDomains(this.ncbiIds)
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
      for (let i = 0; i < 8; i++) {
        cell.push({ text: '', highlight: true });
      }
      this.tableEntries.unshift(cell);
    });
    this.unmatchedGenes = unmatchedGenes.join(', ');
  }

  // Process wrapper to convert domain data into string array that represents domain columns.
  processEnrichmentNodeArray(wrapper: EnrichmentWrapper): TableCell[] {
    const result: TableCell[] = [];
    result[0] = wrapper.regulon.result
      ? {
          text: wrapper.regulon.result.name,
          singleLink: { link: wrapper.regulon.link, linkText: 'Regulon Link' },
        }
      : { text: '' };
    result[1] = wrapper.uniprot.result
      ? {
          text: wrapper.uniprot.result.function,
          singleLink: { link: wrapper.uniprot.link, linkText: 'Uniprot Link' },
        }
      : { text: '' };
    result[2] = wrapper.string.result
      ? {
          text: wrapper.string.result.annotation,
          singleLink: { link: wrapper.string.link, linkText: 'String Link' },
        }
      : { text: '' };
    result[3] = wrapper.molecularGo.result
      ? {
          text: '',
          multiLink: this.processGoWrapper(
            wrapper.molecularGo.linkList,
            wrapper.molecularGo.result
          ),
        }
      : { text: '' };
    result[4] = wrapper.biologicalGo.result
      ? {
          text: '',
          multiLink: this.processGoWrapper(
            wrapper.biologicalGo.linkList,
            wrapper.biologicalGo.result
          ),
        }
      : { text: '' };
    result[5] = wrapper.cellularGo.result
      ? {
          text: '',
          multiLink: this.processGoWrapper(
            wrapper.cellularGo.linkList,
            wrapper.cellularGo.result
          ),
        }
      : { text: '' };
    result[6] = wrapper.biocyc.result
      ? wrapper.biocyc.result.pathways
        ? {
            text: '',
            multiLink: this.processBiocycWrapper(
              wrapper.biocyc.result.pathways, wrapper.biocyc.link
            )
          }
        : {
            text: 'Pathways not found.',
            singleLink: { link: wrapper.biocyc.link, linkText: 'Biocyc Link' },
          }
      : { text: '' };
    return result;
  }

  processGoWrapper(linkArray: string[], nodeArray: GoNode[]): TableLink[] {
    const result: TableLink[] = [];
    for (let i = 0; i < linkArray.length; i++) {
      result.push({ link: linkArray[i], linkText: nodeArray[i].name });
    }
    return result;
  }

  processBiocycWrapper(pathways: string[], biocycLink: string): TableLink[] {
    const result = [];
    pathways.map((pathway) =>
      result.push({ link: biocycLink, linkText: pathway })
    );
    return result;
  }
}

export interface EnrichmentData {
  name: string;
  data: string;
}
