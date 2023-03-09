import { first } from "lodash-es";

import { REGEX } from "../regex";

type TextWrappingMetrics = Pick<TextMetrics, "width">;

/**
 * Helper method that iteratively measures the text of lines as
 * words are added one by one until it exceeds the line width.
 * @param tokens the words
 * @param width the width to not exceed
 */
function* getWidthFittedLines<Metrics extends Pick<TextMetrics, "width">>(
  tokens: string[],
  width: number,
  measureText: (string) => Metrics
): IterableIterator<{ text: string; metrics: Metrics; remainingTokens: boolean }> {
  if (!tokens.length) {
    return;
  }

  const lineStart = first(tokens).trimStart(); // line does not start with space
  let lineTokens = [lineStart];
  let text = lineStart;
  let metrics: Metrics = measureText(lineTokens.join(""));

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];
    lineTokens.push(token);
    const lineTokensWithToken = lineTokens.join("");
    lineTokens.pop();
    const metricsWithToken = measureText(lineTokensWithToken);

    if (metricsWithToken.width > width) {
      yield {
        text,
        metrics,
        remainingTokens: true,
      };

      const lineStartToken = token.trimStart(); // line does not start with space
      lineTokens = [lineStartToken];
      text = lineStartToken;
      metrics = measureText(text);
    } else {
      lineTokens.push(token);
      text = lineTokensWithToken;
      metrics = metricsWithToken;
    }
  }

  // Left over token
  if (lineTokens.length) {
    yield {
      text,
      metrics,
      remainingTokens: false,
    };
  }
}

export function* wrapText<Metrics extends Pick<TextMetrics, "width">>(
  text: string,
  width: number,
  measureText: (string) => Metrics,
  hyphenWidth?: number
): Generator<{ text: string; metrics: Metrics; horizontalOverflow: boolean }> {
  hyphenWidth = hyphenWidth ?? measureText("-").width;
  for (const block of text.split(/\r?\n/g)) {
    // We break on whitespace, word endings and special chars `\.,_-`.
    const words = block.split(REGEX.BETWEEN_TEXT_BREAKS);

    for (const lineWrappedOnTextBreak of getWidthFittedLines(words, width, measureText)) {
      const lineWrappedOnTextBreakOverflow = lineWrappedOnTextBreak.metrics.width > width;

      if (lineWrappedOnTextBreakOverflow) {
        // If we can split on the previous, try to break the words on syllables
        // If there is no match, return the entire string as array (will be marked as overflow)
        const sylabes = lineWrappedOnTextBreak.text.match(REGEX.BETWEEN_SYLABES);
        if (sylabes) {
          for (const wordWrappedOnSylabes of getWidthFittedLines(
            sylabes,
            width - hyphenWidth,
            measureText
          )) {
            yield {
              // Since we break the words, add hyphen.
              text: wordWrappedOnSylabes.text + (wordWrappedOnSylabes.remainingTokens ? "-" : ""),
              metrics: wordWrappedOnSylabes.metrics,
              // If that did not help, we cannot do anything else
              horizontalOverflow: wordWrappedOnSylabes.metrics.width > width,
            };
          }
          continue;
        }
      }
      yield {
        text: lineWrappedOnTextBreak.text,
        metrics: lineWrappedOnTextBreak.metrics,
        horizontalOverflow: lineWrappedOnTextBreakOverflow,
      };
    }
  }
}
