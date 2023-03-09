/**
 * Browser support is really spotty and subject to changes
 * https://caniuse.com/js-regexp-lookbehind
 * Instead of using serries of conditions to check for browser support,
 * we can just check if it works correctly in the current browser.
 */
let BROWSER_SUPPORTS_LOOKBEHIND: boolean;
try {
  // Ussing `new RegExp` to not compile on load in case it is not supported
  // tslint:disable-next-line:no-unused-expression
  new RegExp("(?<=)", "g");
  BROWSER_SUPPORTS_LOOKBEHIND = true;
} catch (e) {
  BROWSER_SUPPORTS_LOOKBEHIND = false;
}

/**
 * Match between whitespaces, word endings and special chars `\.,_-`.
 */
const BETWEEN_TEXT_BREAKS = BROWSER_SUPPORTS_LOOKBEHIND
  ? // Full featured version:
    // Ussing `new RegExp` to not compile on load in case it is not supported
    new RegExp(
      "(?:(?<=\\S)(?=\\s))|(?<=[^\\s\\d\\w]|[\\.,_-])|(?<=\\w)(?=\\W)",
      "gi"
    )
  : // Provide limited support without lookbehind:
    // Ussing `new RegExp` to not compile it on load if we likely do not need it
    new RegExp("(?:[\\.,_-\\s])", "gi");
/**
 * Match between english sylabes.
 */
const BETWEEN_SYLABES =
  /[^aeiouy]*[aeiouy]+(?:[^aeiouy]*$|[^aeiouy](?=[^aeiouy]))?/gi;

/**
 * Math number with potential decimal places.
 */
const FLOAT = /^-?[0-9]*\.?[0-9]*$/;

export const REGEX = {
  BETWEEN_TEXT_BREAKS,
  BETWEEN_SYLABES,
  FLOAT,
};
