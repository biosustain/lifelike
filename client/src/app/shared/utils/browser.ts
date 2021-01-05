import { FileViewComponent } from '../../pdf-viewer/components/file-view.component';
import { WorkspaceManager } from '../workspace-manager';
import { escapeRegExp } from 'lodash';

/**
 * Open a link given by the URL. Handles mailto: and poorly formatted URLs.
 * @param url the URL
 * @param target the window target (default _blank)
 */
export function openLink(url: string, target = '_blank'): boolean {
  if (url == null) {
    return false;
  }

  // Watch out for javascript:!
  if (url.match(/^(http|ftp)s?:\/\//i)) {
    window.open(url, target);
  } else if (url.match(/^\/\//i)) {
    window.open('http:' + url, target);
  } else if (url.match(/^mailto:/i)) {
    window.open(url);
  } else {
    window.open('http://' + url, target);
  }

  return true;
}

export function openPotentialInternalLink(workspaceManager: WorkspaceManager, url: string): boolean {
  const urlObject = new URL(url, window.location.href);
  const openInternally = workspaceManager.isWithinWorkspace()
    && (window.location.hostname === urlObject.hostname
    && (window.location.port || '80') === (urlObject.port || '80'));
  const pathSearchHash = urlObject.pathname + urlObject.search + urlObject.hash;

  if (openInternally) {
    let m;

    m = pathSearchHash.match(/^\/projects\/[^\/]+\/(files|maps)\/([^\/#?]+)/);
    if (m != null) {
      workspaceManager.navigateByUrl(pathSearchHash, {
        newTab: true,
        sideBySide: true,
        matchExistingTab: `^/+projects/[^/]+/files/${escapeRegExp(m[2])}.*`,
        shouldReplaceTab: component => {
          if (m[1] === 'files') {
            const fileViewComponent = component as FileViewComponent;
            const fragmentMatch = url.match(/^[^#]+#(.+)$/);
            if (fragmentMatch) {
              fileViewComponent.scrollInPdf(fileViewComponent.parseLocationFromUrl(fragmentMatch[1]));
            }
          }
          return false;
        },
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
