import { escapeRegExp } from 'lodash-es';

import { EnrichmentTableViewerComponent } from 'app/enrichment/components/table/enrichment-table-viewer.component';
import { PdfViewComponent } from 'app/pdf-viewer/components/pdf-view.component';
import { BiocViewComponent } from 'app/bioc-viewer/components/bioc-view.component';

import { FileTypeShorthand } from '../constants';
import { WorkspaceManager, WorkspaceNavigationExtras } from '../workspace-manager';
import { isNotEmpty } from '../utils';

/**
 * Create a valid url string suitable for <a> tag href usage.
 * @param url - user provided string that might need enhancement - such as adding http:// for external links
 */
export function toValidLink(url: string): string {
  url = url.trim();
  // Watch out for javascript:!
  if (url.match(/^(http|ftp)s?:\/\//i)) {
    return url;
  } else if (url.match(/^\/\//i)) {
    return 'http:' + url;
    // Internal URL begins with single /
  } else if (url.startsWith('/')) {
    return removeViewModeIfPresent(url);
  } else if (url.match(/^mailto:/i)) {
    return url;
  } else {
    return 'http://' + url;
  }
}

export function removeViewModeIfPresent(url: string): string {
  return url.replace(/\/edit[\?#$]/, '');
}


/**
 * Returns the string as a valid URL object
 * @param url - user provided string with url
 */
export function toValidUrl(url: string): URL {
  // Create a valid href string
  url = toValidLink(url);
  let urlObject;
  try {
    // This will fail in case of internal URL
    urlObject = new URL(url);
  } catch (e) {
    if (url.startsWith('/')) {
      urlObject = new URL(url, window.location.href);
    } else {
      urlObject = new URL('https://' + url);
    }
  }
  return urlObject;
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

  url = toValidLink(url);
  window.open(url, target);

  return true;
}

export function openPotentialInternalLink(
  workspaceManager: WorkspaceManager,
  url: string,
  extras: WorkspaceNavigationExtras = {}
): boolean {
  const urlObject = toValidUrl(url);
  const openInternally = workspaceManager.isWithinWorkspace()
      && (window.location.hostname === urlObject.hostname
      && (window.location.port || '80') === (urlObject.port || '80'));
  const pathSearchHash: string = urlObject.pathname + urlObject.search + urlObject.hash;

  if (openInternally) {
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
          ...extras
        }
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
            const {hash, searchParams} = new URL(pathSearchHash, 'http://abc.def');
            if (isNotEmpty(searchParams)) {
              component.route.queryParams.next(searchParams);
            }
            if (hash) {
              component.route.fragment.next(hash.slice(1));
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
          ...extras
        }
      });
      return true;
    }

    // Match a root folder with the `projects` root path
    m = pathSearchHash.match(/^\/projects\/([^\/]+)/);
    if (m) {
      workspaceManager.navigateByUrl({
        url: pathSearchHash,
        extras: {
          // Need the regex end character here so we don't accidentally match a child of this directory
          matchExistingTab: `^/+projects/${escapeRegExp(m[1])}\\?$`,
          ...extras
        }
      });

      return true;
    }

    // Match a root folder with the `folders` root path
    m = pathSearchHash.match(/^\/folders\/([^\/]+)/);
    if (m) {
      workspaceManager.navigateByUrl({
        url: pathSearchHash,
        extras: {
          // Need the regex end character here so we don't accidentally match a child of this directory
          matchExistingTab: `^/+folders/${escapeRegExp(m[1])}\\?$`,
          ...extras
        }
      });

      return true;
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
      workspaceManager.navigateByUrl({
        url: newUrl,
        extras: {
          matchExistingTab: `^/projects/beta-project/files/${fileId}`,
          ...extras
        }
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
          ...extras
        }
      });

      return true;
    }

    // If nothing above matched, just try to open the url normally, with whatever extras were passed in
    workspaceManager.navigateByUrl({
      url,
      extras
    });
    return true;
  }

  return openLink(urlObject.href, '_blank');
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
