import drawingToolPromptForm from './drawing-tool-prompt-form';
import enrichmentPromptForm from './enrichment-prompt-form';
import controls from './control';
import chatCompletionsForm from './chat-completions-form';
import completionsForm from './completions-form';

export default [
  ...chatCompletionsForm,
  ...completionsForm,
  ...controls,
  ...drawingToolPromptForm,
  ...enrichmentPromptForm,
];
