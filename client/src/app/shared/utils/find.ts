import { escapeRegExp } from 'lodash-es';

/**
 * Split a term into separate words.
 * @param s the term
 * @param options extra tokenization options
 */
export function tokenizeQuery(s: string,
                              options: TokenizationOptions = {}): string[] {
  if (options.singleTerm) {
    return [
      s.trim()
    ];
  } else {
    const terms = [];
    let term = '';
    let quoted = false;

    for (const char of s) {
      if (char === '"') {
        quoted = !quoted;
      } else if (!quoted && char === ' ') {
      } else {
        term += char;
        continue;
      }

      const trimmedTerm = term.trim();
      if (trimmedTerm.length) {
        terms.push(trimmedTerm);
      }
      term = '';
    }

    {
      const trimmedTerm = term.trim();
      if (trimmedTerm.length) {
        terms.push(trimmedTerm);
      }
    }

    return terms;
  }
}

/**
 * Compile a function to match search terms within text.
 * @param terms the terms to match
 * @param options extra options
 */
export function compileFind(terms: string[],
                            options: FindOptions = {}):
  (string) => boolean {
  const wrapper = options.wholeWord ? '\\b' : '';
  let termPatterns;

  if (options.keepSearchSpecialChars) {
    termPatterns = terms.map(term => {
      const pat = escapeRegExp(term)
        .replace(' ', ' +')
        .replace(/(\\\*)/g, '\\w*')
        .replace(/(\\\?)/g, '\\w?');
      return wrapper + pat + wrapper;
    });
  } else {
    termPatterns = terms.map(
      term => wrapper + escapeRegExp(term).replace(' ', ' +') + wrapper
    );
  }

  const pattern = new RegExp(termPatterns.join('|'), 'i');
  return s => pattern.test(s);
}

export interface TokenizationOptions {
  singleTerm?: boolean;
}

export interface FindOptions {
  wholeWord?: boolean;
  keepSearchSpecialChars?: boolean;
}
