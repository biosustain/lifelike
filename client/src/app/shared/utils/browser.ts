import { escapeRegExp, last } from 'lodash-es';

import { EnrichmentTableViewerComponent } from 'app/enrichment/components/table/enrichment-table-viewer.component';
import { PdfViewComponent } from 'app/pdf-viewer/components/pdf-view.component';
import { BiocViewComponent } from 'app/bioc-viewer/components/bioc-view.component';

import { FileTypeShorthand } from '../constants';
import { WorkspaceManager, WorkspaceNavigationExtras } from '../workspace-manager';
import { AppURL } from './url';
import { isNotEmpty } from '../utils';

export function removeViewModeIfPresent(url: AppURL): AppURL {
  if (last(url.pathSegments) === 'edit') {
    url.pathSegments.pop();
  }
  return url;
}

/**
 * Open a link given by the URL. Handles mailto: and poorly formatted URLs.
 * @param url the URL
 * @param target the window target (default _blank)
 */
export function openLink(url: AppURL, target = '_blank'): Window | null {
  return url.isEmpty ? null : window.open(url.toString(), target);
}

export function openInternalLink(
  workspaceManager: WorkspaceManager,
  urlObject: URL,
  extras: WorkspaceNavigationExtras = {}
): Promise<boolean> {
  const url = urlObject.toString();
  const pathSearchHash: string = urlObject.pathname + urlObject.search + urlObject.hash;

  let m;

  // TODO: Folder tabs have a slightly different URL structure than other files for some reason, so we need to check for them manually.
  // You can verify this behavior by opening a folder and a file in the workspace and clicking the "Share" button in the tab options
  // for each.
  m = pathSearchHash.match(/^\/projects\/[^\/]+\/folders\/([^\/#?]+)/);
  if (m) {
    return workspaceManager.navigateByUrl({
      url: pathSearchHash,
      extras: {
        matchExistingTab: `^/+folders/${escapeRegExp(m[1])}.*`,
        ...extras
      }
    });
  }

  // Match a full file path (e.g. /projects/MyProject/files/myFileHash123XYZ)
  m = pathSearchHash.match(/^\/projects\/[^\/]+\/([^\/]+)\/([^\/#?]+)/);
  if (m) {
    let shouldReplaceTab;

    switch (m[1]) {
      case FileTypeShorthand.Pdf: {
        shouldReplaceTab = (component) => {
          const fileViewComponent = component as PdfViewComponent;
          const fragmentMatch = url.match(/^[^#]+#(.+)$/);
          if (fragmentMatch) {
            fileViewComponent.scrollInPdf(fileViewComponent.parseLocationFromUrl(fragmentMatch[1]));
          }
        };
        break;
      }
      case FileTypeShorthand.EnrichmentTable: {
        shouldReplaceTab = (component) => {
          const enrichmentTableViewerComponent = component as EnrichmentTableViewerComponent;
          const fragmentMatch = url.match(/^[^#]+#(.+)$/);
          if (fragmentMatch) {
            enrichmentTableViewerComponent.annotation = enrichmentTableViewerComponent.parseAnnotationFromUrl(fragmentMatch[1]);
            enrichmentTableViewerComponent.startAnnotationFind(
              enrichmentTableViewerComponent.annotation.id,
              enrichmentTableViewerComponent.annotation.text,
              enrichmentTableViewerComponent.annotation.color
            );
          }
        };
        break;
      }
      case FileTypeShorthand.BioC: {
        shouldReplaceTab = (component) => {
          const fragmentMatch = url.match(/^[^#]+#(.+)$/);
          const biocViewComponent = component as BiocViewComponent;
          if (fragmentMatch && fragmentMatch[1]) {
            (biocViewComponent).scrollInOffset(biocViewComponent.parseLocationFromUrl(fragmentMatch[1]));
          }
        };
        break;
      }
      case FileTypeShorthand.Graph: {
        shouldReplaceTab = (component) => {
          const {fragment, searchParamsObject} = new AppURL(pathSearchHash);
          if (isNotEmpty(searchParamsObject)) {
            component.route.queryParams.next(searchParamsObject);
          }
          if (fragment) {
            component.route.fragment.next(fragment);
          }
        };
        break;
      }
      case FileTypeShorthand.Map:
      case FileTypeShorthand.Directory:
        shouldReplaceTab = (component) => {};
        break;
    }

    return workspaceManager.navigateByUrl({
      url: pathSearchHash,
      extras: {
        matchExistingTab: `^/+projects/[^/]+/([^/]+)/${escapeRegExp(m[2])}.*`,
        shouldReplaceTab,
        ...extras
      }
    });
  }

  // Match a ***ARANGO_USERNAME*** folder with the `projects` ***ARANGO_USERNAME*** path
  m = pathSearchHash.match(/^\/projects\/([^\/]+)/);
  if (m) {
    return workspaceManager.navigateByUrl({
      url: pathSearchHash,
      extras: {
        // Need the regex end character here so we don't accidentally match a child of this directory
        matchExistingTab: `^/+projects/${escapeRegExp(m[1])}\\?$`,
        ...extras
      }
    });
  }

  // Match a ***ARANGO_USERNAME*** folder with the `folders` ***ARANGO_USERNAME*** path
  m = pathSearchHash.match(/^\/folders\/([^\/]+)/);
  if (m) {
    return workspaceManager.navigateByUrl({
      url: pathSearchHash,
      extras: {
        // Need the regex end character here so we don't accidentally match a child of this directory
        matchExistingTab: `^/+folders/${escapeRegExp(m[1])}\\?$`,
        ...extras
      }
    });
  }

  // Match a deprecated pdf link
  m = pathSearchHash.match(/^\/dt\/pdf/);
  if (m) {
    const [
      fileId,
      page,
      coordA,
      coordB,
      coordC,
      coordD,
    ] = pathSearchHash.replace(/^\/dt\/pdf\//, '').split('/');
    const newUrl = `/projects/beta-project/files/${fileId}#page=${page}&coords=${coordA},${coordB},${coordC},${coordD}`;
    return workspaceManager.navigateByUrl({
      url: newUrl,
      extras: {
        matchExistingTab: `^/projects/beta-project/files/${fileId}`,
        ...extras
      }
    });
  }

  // Match a deprecated map link
  m = pathSearchHash.match(/^\/dt\/map\/([0-9a-f]+)$/);
  if (m) {
    return workspaceManager.navigateByUrl({
      url: `/dt/map/${m[1]}`,
      extras: {
        matchExistingTab: `/maps/${m[1]}`,
        ...extras
      }
    });
  }

  // If nothing above matched, just try to open the url normally, with whatever extras were passed in
  return workspaceManager.navigateByUrl({
    url: pathSearchHash,
    extras
  });
}

export function openPotentialExternalLink(
  workspaceManager: WorkspaceManager,
  url: string,
  extras: WorkspaceNavigationExtras = {}
): Promise<boolean> | Window | null {
  const urlObject = new AppURL(url);
  const openInternally = workspaceManager.isWithinWorkspace()
      && (window.location.hostname === urlObject.hostname
      && (window.location.port || '80') === (urlObject.port || '80'));

  if (openInternally) {
    return openInternalLink(workspaceManager, urlObject, extras);
  }

  return openLink(urlObject, '_blank');
}


const DOMAIN_MAP = new Map([
  [/^((https|http)(:\/\/))?(www.)?ncbi.nlm.nih.gov\/gene\/.+$/, 'NCBI Gene'],
  [/^((https|http)(:\/\/))?(www.)?ncbi.nlm.nih.gov\/Taxonomy\/.+$/, 'NCBI Taxonomy'],
  [/^((https|http)(:\/\/))?(www.)?ncbi.nlm.nih.gov\/mesh\/.+$/, 'MeSH'],
  [/^((https|http)(:\/\/))?(www.)?ebi.ac.uk\/.+$/, 'ChEBI'],
  [/^((https|http)(:\/\/))?(www.)?uniprot.org\/.+$/, 'UniProt'],
  [/^((https|http)(:\/\/))?(www.)?amigo.geneontology.org\/.+$/, 'GO'],
  [/^((https|http)(:\/\/))?(www.)?pubchem.ncbi.nlm.nih.gov\/.+$/, 'PubChem'],
  [/^((https|http)(:\/\/))?(www.)?biocyc.org\/.+$/, 'BioCyc'],
]);

// Match the url address with the domain
export function parseURLToDomainName(url: string, defaultReturn?: string): string {
  for (const [re, val] of DOMAIN_MAP.entries()) {
    if (re.exec(url)) {
      return val;
    }
  }
  return defaultReturn || 'Link';
}
