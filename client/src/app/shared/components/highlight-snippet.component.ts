import { Component, Input, OnChanges } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { hexToRGBA } from 'app/shared/utils';

@Component({
  selector: 'app-highlight-snippet',
  templateUrl: './highlight-snippet.component.html',
  styleUrls: ['./highlight-snippet.component.scss']
})
export class HighlightSnippetComponent implements OnChanges {
    @Input() snippet = '';
    @Input() entry1Text = '';
    @Input() entry2Text = '';
    @Input() entry1Type = '';
    @Input() entry2Type = '';
    @Input() legend: Map<string, string[]> = new Map<string, string[]>();

    highlightedSnippet = '';

    trustedHTML: SafeHtml;

    constructor(
        private domSanitizer: DomSanitizer,
    ) { }

    ngOnChanges() {
        const entry1BackgroundColor = this.legend.get(this.entry1Type)[0];

        const entry1StyleString = `
            background-color: ${hexToRGBA(entry1BackgroundColor, 0.3)};
            display: inline-block;
            padding: 0px 1.5px;
            text-align: center;
            vertical-align: middle;
        `;

        const entry2BackgroundColor = this.legend.get(this.entry2Type)[0];
        const entry2StyleString = `
            background-color: ${hexToRGBA(entry2BackgroundColor, 0.3)};
            display: inline-block;
            padding: 0px 1.5px;
            text-align: center;
            vertical-align: middle;
        `;

        const styleMap = {};
        styleMap[this.entry1Text] = `<div style="${entry1StyleString}">${this.entry1Text}</div>`;
        styleMap[this.entry2Text] = `<div style="${entry2StyleString}">${this.entry2Text}</div>`;

        this.highlightedSnippet = this.snippet.replace(new RegExp(`\\b${this.entry1Text}|${this.entry2Text}\\b`, 'g'), match => {
            return styleMap[match];
        });

        // We have to be VERY careful using this! It could expose our site to XSS attacks if we aren't cautious.
        this.trustedHTML = this.domSanitizer.bypassSecurityTrustHtml(this.highlightedSnippet);
    }
}
