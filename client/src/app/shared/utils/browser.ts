import { escapeRegExp } from 'lodash-es';

import { EnrichmentTableViewerComponent } from 'app/enrichment/components/table/enrichment-table-viewer.component';
import { PdfViewComponent } from 'app/pdf-viewer/components/pdf-view.component';
import { BiocViewComponent } from 'app/bioc-viewer/components/bioc-view.component';

import { FileTypeShorthand } from '../constants';
import { WorkspaceManager, WorkspaceNavigationExtras } from '../workspace-manager';
import { isNotEmpty } from '../utils';
import { AppURL, HttpURL } from '../url';
import { NCBI, CHEBI, UNIPROT, PUBCHEM, BIOCYC, GO } from '../url/constants';
import { findURLMapping } from '../url/internal';

export function removeViewModeIfPresent(url: string): string {
  return url.replace(/\/edit[\?#$]?/, '');
}


/**
 * Open a link given by the URL. Handles mailto: and poorly formatted URLs.
 * @param url the URL
 * @param target the window target (default _blank)
 */
export function openLink(url: string, target = '_blank'): boolean {
  if (url == null) {
    return false;
  }

  window.open(new AppURL(url).toString(), target);

  return true;
}

export function openInternalLink(
  workspaceManager: WorkspaceManager,
  urlObject: URL,
  extras: WorkspaceNavigationExtras = {}
) {
  const url = urlObject.toString();
  const pathSearchHash: string = urlObject.pathname + urlObject.search + urlObject.hash;

  let m;

  // TODO: Folder tabs have a slightly different URL structure than other files for some reason, so we need to check for them manually.
  // You can verify this behavior by opening a folder and a file in the workspace and clicking the "Share" button in the tab options
  // for each.
  m = pathSearchHash.match(/^\/projects\/[^\/]+\/folders\/([^\/#?]+)/);
  if (m) {
    workspaceManager.navigateByUrl({
      url: pathSearchHash,
      extras: {
        matchExistingTab: `^/+folders/${escapeRegExp(m[1])}.*`,
        ...extras,
      },
    });

    return true;
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
            enrichmentTableViewerComponent.annotation =
              enrichmentTableViewerComponent.parseAnnotationFromUrl(fragmentMatch[1]);
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
            biocViewComponent.scrollInOffset(
              biocViewComponent.parseLocationFromUrl(fragmentMatch[1])
            );
          }
        };
        break;
      }
      case FileTypeShorthand.Graph: {
        shouldReplaceTab = (component) => {
          const {fragment, searchParamsObject } = new HttpURL(pathSearchHash);
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

    workspaceManager.navigateByUrl({
      url: pathSearchHash,
      extras: {
        matchExistingTab: `^/+projects/[^/]+/([^/]+)/${escapeRegExp(m[2])}.*`,
        shouldReplaceTab,
        ...extras,
      },
    });
    return true;
  }

  // Match a ***ARANGO_USERNAME*** folder with the `projects` ***ARANGO_USERNAME*** path
  m = pathSearchHash.match(/^\/projects\/([^\/]+)/);
  if (m) {
    workspaceManager.navigateByUrl({
      url: pathSearchHash,
      extras: {
        // Need the regex end character here so we don't accidentally match a child of this directory
        matchExistingTab: `^/+projects/${escapeRegExp(m[1])}\\?$`,
        ...extras,
      },
    });

    return true;
  }

  // Match a ***ARANGO_USERNAME*** folder with the `folders` ***ARANGO_USERNAME*** path
  m = pathSearchHash.match(/^\/folders\/([^\/]+)/);
  if (m) {
    workspaceManager.navigateByUrl({
      url: pathSearchHash,
      extras: {
        // Need the regex end character here so we don't accidentally match a child of this directory
        matchExistingTab: `^/+folders/${escapeRegExp(m[1])}\\?$`,
        ...extras,
      },
    });

    return true;
  }

  // Match a deprecated pdf link
  m = pathSearchHash.match(/^\/dt\/pdf/);
  if (m) {
    const [fileId, page, coordA, coordB, coordC, coordD] = pathSearchHash
      .replace(/^\/dt\/pdf\//, '')
      .split('/');
    const newUrl = `/projects/beta-project/files/${fileId}#page=${page}&coords=${coordA},${coordB},${coordC},${coordD}`;
    workspaceManager.navigateByUrl({
      url: newUrl,
      extras: {
        matchExistingTab: `^/projects/beta-project/files/${fileId}`,
        ...extras,
      },
    });

    return true;
  }

  // Match a deprecated map link
  m = pathSearchHash.match(/^\/dt\/map\/([0-9a-f]+)$/);
  if (m) {
    workspaceManager.navigateByUrl({
      url: `/dt/map/${m[1]}`,
      extras: {
        matchExistingTab: `/maps/${m[1]}`,
        ...extras,
      },
    });

    return true;
  }

  // If nothing above matched, just try to open the url normally, with whatever extras were passed in
  workspaceManager.navigateByUrl({
    url: pathSearchHash,
    extras,
  });
  return true;
}

export function openPotentialExternalLink(
  workspaceManager: WorkspaceManager,
  url: string,
  extras: WorkspaceNavigationExtras = {}
): boolean {
  const urlObject = new HttpURL(url);
  const openInternally = workspaceManager.isWithinWorkspace()
      && (window.location.hostname === urlObject.hostname
      && (window.location.port || '80') === (urlObject.port || '80'));

  if (openInternally) {
    return openInternalLink(workspaceManager, urlObject, extras);
  }

  return openLink(urlObject.href, '_blank');
}

const DOMAIN_MAP = new Map([
  [{ domain: NCBI.url.domain, patchSegments: ['gene'] }, 'NCBI Gene'],
  [{ domain: NCBI.url.domain, patchSegments: ['Taxonomy'] }, 'NCBI Taxonomy'],
  [{ domain: NCBI.url.domain, patchSegments: ['mesh'] }, 'MeSH'],
  [{ domain: CHEBI.url.domain }, 'ChEBI'],
  [{ domain: UNIPROT.url.domain }, 'UniProt'],
  [{ domain: GO.url.domain }, 'GO'],
  [{ domain: PUBCHEM.url.domain }, 'PubChem'],
  [{ domain: BIOCYC.url.domain }, 'BioCyc'],
]);

const domainMapper = findURLMapping(DOMAIN_MAP);

// Match the url address with the domain
export const parseURLToDomainName = (url: string|AppURL, defaultReturn?: string): string =>
  domainMapper(AppURL.from(url)) ?? defaultReturn ?? 'Link';
