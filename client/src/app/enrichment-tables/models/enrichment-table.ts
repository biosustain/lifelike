import { TableCell, TableHeader } from '../../shared/components/table/generic-table.component';
import { EnrichmentDocument, EnrichmentResult } from './enrichment-document';
import { Observable, of } from 'rxjs';
import { isEqual } from 'lodash';
import { nullCoalesce } from '../../shared/utils/types';

export class EnrichmentTable {

  tableHeader: TableHeader[][] = [];
  tableCells: TableCell[][] = [];

  load(document: EnrichmentDocument): Observable<this> {
    const tableCells: TableCell[][] = [];
    const tableHeader: TableHeader[][] = [
      [
        {name: 'Imported', span: '1'},
        {name: 'Matched', span: '1'},
        {name: 'NCBI Gene Full Name', span: '1'},
      ],
    ];

    const result: EnrichmentResult | undefined = document.result;

    if (result != null) {
      const domainInfoMap = result.domainInfo;

      // Some domains have multiple labels so we need to activate a
      // second header line in those cases
      let tableHeaderLine2Needed = false;
      const tableHeaderLine2: TableHeader[] = [
        {name: '', span: '3'},
      ];

      for (const domainId of document.domains) {
        const domainInfo = domainInfoMap[domainId];

        // If a domain has one label, we put that label in the first header
        // row like (Domain) (Label), otherwise we put each label in its own cell on the
        // second header row
        tableHeader[0].push({
          name: domainId + (domainInfo.labels.length > 1 ? '' : ' ' +
            nullCoalesce(domainInfo.labels[0], '')),
          span: String(domainInfo.labels.length),
        });

        if (domainInfo.labels.length > 1) {
          tableHeaderLine2Needed = true;

          for (const label of domainInfo.labels) {
            tableHeaderLine2.push({
              name: label,
              span: '1',
            });
          }
        } else {
          tableHeaderLine2.push({
            name: '',
            span: '1',
          });
        }
      }

      if (tableHeaderLine2Needed) {
        tableHeader.push(tableHeaderLine2);
      }

      for (const resultGene of result.genes) {
        const row: TableCell[] = [{
          text: resultGene.imported,
        }];

        if (resultGene.domains) {
          // There was a match
          row.push({
            text: resultGene.matched,
          });

          row.push({
            text: resultGene.fullName,
            singleLink: {
              link: resultGene.link,
              linkText: 'NCBI Link',
            },
          });

          for (const domainId of document.domains) {
            const domainInfo = domainInfoMap[domainId];
            for (const label of domainInfo.labels) {
              const geneDomainResult = resultGene.domains[domainId] && resultGene.domains[domainId][label];
              if (geneDomainResult) {
                row.push({
                  text: geneDomainResult.annotatedText,  // if enrichment is not annotated, annotatedText == text
                  singleLink: {
                    link: geneDomainResult.link,
                    linkText: `${domainId} Link`,
                  },
                });
              } else {
                row.push({text: ''});
              }
            }
          }

        } else {
          // No gene match
          row.push({text: 'No match found.'});
          row.push({text: ''});

          // Add a bunch of empty cells
          for (const domainId of document.domains) {
            const domainInfo = domainInfoMap[domainId];
            for (const label of domainInfo.labels) {
              row.push({text: ''});
            }
          }
        }

        tableCells.push(row);
      }
    }

    this.tableHeader = tableHeader;
    this.tableCells = tableCells;

    return of(this);
  }

  equals(other: EnrichmentTable) {
    return isEqual(this.tableHeader, other.tableHeader) && isEqual(this.tableCells, other.tableCells);
  }

}
