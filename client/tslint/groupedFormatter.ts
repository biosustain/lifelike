// noinspection JSAnnotator
/**
 * To compile this file run `yarn run compileTsLintCustomisations`
 */

import * as Lint from 'tslint';
import { RuleSeverity } from 'tslint/lib/language/rule/rule';
import { RuleFailure } from 'tslint';

export class Formatter extends Lint.Formatters.StylishFormatter {
  protected sortFailures(failures: RuleFailure[]): RuleFailure[] {
    const groupedFailures: {
      [ruleSeverity in RuleSeverity]: Lint.RuleFailure[]
    } = {
      warning: [],
      error: [],
      off: []
    };
    for (const failure of failures) {
      groupedFailures[failure.getRuleSeverity()].push(failure);
    }
    return [].concat(
      groupedFailures.off.sort(RuleFailure.compare),
      groupedFailures.warning.sort(RuleFailure.compare),
      groupedFailures.error.sort(RuleFailure.compare)
    );
  }
}
