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
