'use strict';
/**
 * Error-centric reversed severity sorter - ESLint formatter wrapper
 *
 * ESLint sorts results by severity, considering the total count of errors and warnings.
 * - We want severity to be based on the number on errors, using warnings only as a tie-breaker.
 * - We want to reverse the default order, so most severe results are last.
 */

const formatterName = process.env.ESLINT_FORMATTER || 'stylish';
const formatterFn = require(`eslint/lib/cli-engine/formatters/${formatterName}.js`);

const totalErrorCount = (result) => result.errorCount + result.fatalErrorCount;

// Compare two results by total error count, if they're equal, then compare by warning count.
const severityComparator = (a, b) => {
  return totalErrorCount(a) - totalErrorCount(b) || a.warningCount - b.warningCount;
};

module.exports = function (results) {
  return formatterFn(results.sort(severityComparator));
};
