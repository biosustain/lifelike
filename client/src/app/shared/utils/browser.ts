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
