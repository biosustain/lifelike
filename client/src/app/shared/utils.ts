import { OperatingSystems } from 'app/interfaces/shared.interface';

/**
 * Converts a string to hex.
 * TODO: Consider a better way to encode data (e.g. base64/32)
 *
 * Use cases:
 * 1. Allow us to use various characters without having
 * to deal with escaping them in URLs
 * (i.e.) n1,n2&n3,n4 does not need to have the & escaped
 */
export function stringToHex(s: string) {
    const hexFormat = [];
    for (let i = 0, l = s.length; i < l; i++) {
        const hex = Number(s.charCodeAt(i)).toString(16);
        hexFormat.push(hex);
    }
    return hexFormat.join('');
}

/**
 * Generate a UUID. Source: https://stackoverflow.com/a/2117523
 */
export function uuidv4(): string {
    // @ts-ignore
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
        /* tslint:disable:no-bitwise*/
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}


/**
 * Determines which event listener to use (dependent on browser)
 */
export function whichTransitionEvent() {
    const el = document.createElement('fakeelement');
    const transitions = {
        animation: 'animationend',
        OAnimation: 'oAnimationEnd',
        MozAnimation: 'animationend',
        WebkitAnimation: 'webkitAnimationEnd',
    };

    for (const t in transitions) {
        if ( el.style[t] !== undefined ) {
            return transitions[t];
        }
    }
}

export function getClientOS() {
    if (navigator.appVersion.indexOf('Linux') !== -1) {
        return OperatingSystems.LINUX;
    }
    if (navigator.appVersion.indexOf('Mac') !== -1) {
        return OperatingSystems.MAC;
    }
    if (navigator.appVersion.indexOf('Win') !== -1) {
        return OperatingSystems.WINDOWS;
    }
    return OperatingSystems.UNKNOWN;

}

export function keyCodeRepresentsCopyEvent(event: any) {
  const clientOS = getClientOS();
  switch (clientOS) {
    case OperatingSystems.MAC: {
      if (event.code === 'KeyC' && event.metaKey === true) {
        return true;
      }
      return false;
    }
    case OperatingSystems.LINUX:
    case OperatingSystems.WINDOWS: {
      if (event.code === 'KeyC' && event.ctrlKey === true) {
        return true;
      }
      return false;
    }
    default: {
      return false;
    }
  }
}

export function keyCodeRepresentsPasteEvent(event: any) {
    const clientOS = getClientOS();
    switch (clientOS) {
        case OperatingSystems.MAC: {
            if (event.code === 'KeyV' && event.metaKey === true) {
                return true;
            }
            return false;
        }
        case OperatingSystems.LINUX:
        case OperatingSystems.WINDOWS: {
            if (event.code === 'KeyV' && event.ctrlKey === true) {
                return true;
            }
            return false;
        }
        default: {
            return false;
        }
    }
}
