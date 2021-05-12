import { escapeRegExp } from 'lodash';

import { EnrichmentTableViewerComponent } from 'app/enrichment/components/table/enrichment-table-viewer.component';
import { FileViewComponent } from 'app/pdf-viewer/components/file-view.component';

import { WorkspaceManager } from '../workspace-manager';

export function toValidLink(url: string) {
  let newUrl: string;
  // Watch out for javascript:!
  if (url.match(/^(http|ftp)s?:\/\//i)) {
    newUrl = url;
  } else if (url.match(/^\/\//i)) {
    newUrl = 'http:' + url;
  } else if (url.match(/^mailto:/i)) {
    newUrl = url;
  } else {
    newUrl = 'http://' + url;
  }
  const urlObject = new URL(newUrl);
  return newUrl;
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

export function openPotentialInternalLink(workspaceManager: WorkspaceManager, url: string,
                                          defaultExternal = true): boolean {
  let urlObject;
  try {
    urlObject = new URL(url);
  } catch (e) {
    if (defaultExternal) {
      urlObject = new URL('http://' + url);
    } else {
      urlObject = new URL(url, window.location.href);
    }
  }

  const openInternally = workspaceManager.isWithinWorkspace()
    && (window.location.hostname === urlObject.hostname
      && (window.location.port || '80') === (urlObject.port || '80'));
  const pathSearchHash = urlObject.pathname + urlObject.search + urlObject.hash;

  if (openInternally) {
    let m;

    // TODO: Folder tabs have a slightly different URL structure than other files for some reason, so we need to check for them manually
    m = pathSearchHash.match(/^\/projects\/[^\/]+\/folders\/([^\/#?]+)/);
    if (m != null) {
      workspaceManager.navigateByUrl(pathSearchHash, {
        newTab: true,
        sideBySide: true,
        matchExistingTab: `^/+folders/${escapeRegExp(m[2])}.*`,
      });

      return true;
    }

    m = pathSearchHash.match(/^\/projects\/[^\/]+\/([^\/]+)\/([^\/#?]+)/);
    if (m != null) {
      workspaceManager.navigateByUrl(pathSearchHash, {
        newTab: true,
        sideBySide: true,
        matchExistingTab: `^/+projects/[^/]+/([^/]+)/${escapeRegExp(m[2])}.*`,
        shouldReplaceTab: component => {
          if (m[1] === 'files') {
            const fileViewComponent = component as FileViewComponent;
            const fragmentMatch = url.match(/^[^#]+#(.+)$/);
            if (fragmentMatch) {
              fileViewComponent.scrollInPdf(fileViewComponent.parseLocationFromUrl(fragmentMatch[1]));
            }
          } else if (m[1] === 'enrichment-table') {
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

            return false;
          }
          return false;
        },
      });

      return true;
    }

    m = pathSearchHash.match(/^\/projects\/([^\/]+)/);
    if (m != null) {
      workspaceManager.navigateByUrl(pathSearchHash, {
        newTab: true,
        sideBySide: true,
        // Need the regex end character here so we don't accidentally match a child of this directory
        matchExistingTab: `^/+projects/${escapeRegExp(m[1])}\\??$`,
      });

      return true;
    }

    m = pathSearchHash.match(/^\/dt\/pdf/);
    if (m != null) {
      const [
        fileId,
        page,
        coordA,
        coordB,
        coordC,
        coordD,
      ] = pathSearchHash.replace(/^\/dt\/pdf\//, '').split('/');
      const newUrl = `/projects/beta-project/files/${fileId}#page=${page}&coords=${coordA},${coordB},${coordC},${coordD}`;
      workspaceManager.navigateByUrl(newUrl, {
        newTab: true,
        sideBySide: true,
        matchExistingTab: `^/projects/beta-project/files/${fileId}`,
      });

      return true;
    }

    m = pathSearchHash.match(/^\/dt\/map\/([0-9a-f]+)$/);
    if (m != null) {
      workspaceManager.navigateByUrl(`/dt/map/${m[1]}`, {
        newTab: true,
        sideBySide: true,
        matchExistingTab: `/maps/${m[1]}`,
      });

      return true;
    }
  }

  return openLink(urlObject.href, '_blank');
}
