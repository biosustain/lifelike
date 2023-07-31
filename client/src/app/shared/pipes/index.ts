import { FriendlyDateStrPipe } from './friendly-date-str.pipe';
import { TruncatePipe } from './truncate.pipe';
import { ScrubHtmlPipe } from './scrub-html.pipe';
import { NodeTextStylePipe } from './node-text-style.pipe';
import { AddStatusPipe } from './add-status.pipe';

export { TruncatePipe, FriendlyDateStrPipe, ScrubHtmlPipe };

export default [TruncatePipe, ScrubHtmlPipe, FriendlyDateStrPipe, NodeTextStylePipe, AddStatusPipe];
