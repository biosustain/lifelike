import { TableCell, TableHeader } from '../../shared/components/table/generic-table.component';
import { EnrichmentWrapper, GoNode, NCBINode } from '../services/enrichment-table.service';
import { EnrichmentDocument, EnrichmentResult } from './enrichment-document';
import { Observable, of } from 'rxjs';
import { isEqual } from 'lodash';

export class EnrichmentTable {

  // Inputs for Generic Table Component
  // Map where column name is mapped to first row of table header.
  private headerMap: Map<string, TableHeader[]> = new Map([
    ['Regulon', [{name: 'Regulon Data', span: '3'}]],
    ['UniProt', [{name: 'Uniprot Function', span: '1'}]],
    ['String', [{name: 'String Annotation', span: '1'}]],
    ['GO', [{name: 'GO Annotation', span: '1'}]],
    ['Biocyc', [{name: 'Biocyc Pathways', span: '1'}]],
  ]);
  // Map where column name is mapped to second row of table header.
  private secondHeaderMap: Map<string, TableHeader[]> = new Map([
    ['Default', [{name: '', span: '1'}, {name: '', span: '1'}, {name: '', span: '1'}]],
    ['Regulon', [{name: 'Regulator Family', span: '1'}, {name: 'Activated By', span: '1'},
      {name: 'Repressed By', span: '1'}]],
    ['UniProt', [{name: '', span: '1'}]],
    ['String', [{name: '', span: '1'}]],
    ['GO', [{name: '', span: '1'}]],
    ['Biocyc', [{name: '', span: '1'}]],
  ]);

  tableEntries: TableCell[][] = [];
  tableHeader: TableHeader[][] = [
    // Primary headers
    [
      {name: 'Imported', span: '1'},
      {name: 'Matched', span: '1'},
      {name: 'NCBI Gene Full Name', span: '1'},
    ],
  ];

  private geneNames: string[];

  load(document: EnrichmentDocument): Observable<this> {
    this.initializeHeaders(document.domains);

    const result: EnrichmentResult = document.result;
    const synonyms = result.ncbiNodes.map((wrapper) => wrapper.s.name);
    const ncbiNodes = result.ncbiNodes.map((wrapper) => wrapper.x);
    const ncbiIds = result.ncbiNodes.map((wrapper) => wrapper.neo4jID);
    const ncbiLinks = result.ncbiNodes.map((wrapper) => wrapper.link);

    let newEntries = result.domainResults.map((wrapper) =>
      this.processEnrichmentNodeArray(document.domains, wrapper, ncbiNodes, ncbiIds),
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
    newEntries = newEntries.concat(this.processUnmatchedNodes(synonyms, document.importGenes));
    this.tableEntries = this.tableEntries.concat(newEntries);
    return of(this);
  }

  /**
   * Change the table headers based on column order and domain input.
   */
  private initializeHeaders(domains: string[]) {
    this.tableHeader = [
      [
        {name: 'Imported', span: '1'},
        {name: 'Matched', span: '1'},
        {name: 'NCBI Gene Full Name', span: '1'},
      ],
    ];
    if (domains.includes('Regulon')) {
      this.tableHeader[1] = this.secondHeaderMap.get('Default');
    }
    domains.forEach((domain) => {
      this.tableHeader[0] = this.tableHeader[0].concat(this.headerMap.get(domain));
      if (domains.includes('Regulon')) {
        this.tableHeader[1] = this.tableHeader[1].concat(this.secondHeaderMap.get(domain));
      }
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
   * If certain properties of domain (result or some property on result) are not defined, add TableCell with empty string.
   * TODO: Could make more efficient by adding domain as input to domain get request.
   * @param domains requested domains
   * @param wrapper data returned from get domains request
   * @param ncbiNodes matched ncbi data
   * @param ncbiIds matched ncbi ids
   * @returns table entries
   */
  private processEnrichmentNodeArray(domains: string[], wrapper: EnrichmentWrapper,
                                     ncbiNodes: NCBINode[], ncbiIds: number[]): TableCell[] {
    const result: TableCell[] = [];
    const columnOrder = [...domains];
    if (columnOrder.includes('Regulon')) {
      const index = columnOrder.indexOf('Regulon');
      columnOrder.splice(index + 1, 0, 'Regulon 3');
      columnOrder.splice(index + 1, 0, 'Regulon 2');
    }
    if (domains.includes('Regulon')) {
      if (wrapper.regulon.result !== null) {
        result[columnOrder.indexOf('Regulon')] = (
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
        result[columnOrder.indexOf('Regulon 2')] = (
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
        result[columnOrder.indexOf('Regulon 3')] = (
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
          result[columnOrder.indexOf('Regulon') + i] = ({text: ''});
        }
      }
    }
    if (domains.includes('UniProt')) {
      result[columnOrder.indexOf('UniProt')] = (
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
    if (domains.includes('String')) {
      result[columnOrder.indexOf('String')] = (
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
    if (domains.includes('GO')) {
      result[columnOrder.indexOf('GO')] = (
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
    if (domains.includes('Biocyc')) {
      result[columnOrder.indexOf('Biocyc')] = (
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

  private processGoWrapper(nodeArray: GoNode[]): string {
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

  equals(other: EnrichmentTable) {
    return isEqual(this.tableHeader, other.tableHeader) && isEqual(this.tableEntries, other.tableEntries);
  }

}
