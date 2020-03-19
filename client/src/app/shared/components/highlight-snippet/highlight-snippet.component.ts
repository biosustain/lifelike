import { Component, OnInit, Input, OnChanges } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-highlight-snippet',
  templateUrl: './highlight-snippet.component.html',
  styleUrls: ['./highlight-snippet.component.scss']
})
export class HighlightSnippetComponent implements OnInit, OnChanges {
    @Input() snippet = '';
    @Input() entry1Text = '';
    @Input() entry2Text = '';
    @Input() entry1Colors: string[];
    @Input() entry2Colors: string[];

    highlightedSnippet = '';

    trustedHTML: SafeHtml;

    constructor(
        private domSanitizer: DomSanitizer,
    ) { }

    ngOnInit() { }

    ngOnChanges() {
        const entry1BackgroundColor = this.entry1Colors[0];
        const entry1BorderColor = this.entry1Colors[1];

        const entry1StyleString = `
            background: ${entry1BackgroundColor};
            border: thin solid ${entry1BorderColor};
            border-radius: 5px;
        `;

        const entry2BackgroundColor = this.entry2Colors[0];
        const entry2BorderColor = this.entry2Colors[0];
        const entry2StyleString = `
            background: ${entry2BackgroundColor};
            border: thin solid ${entry2BorderColor};
            border-radius: 5px;
        `;

        const styleMap = {};
        styleMap[this.entry1Text] = `<span style="${entry1StyleString}">${this.entry1Text}</span>`;
        styleMap[this.entry2Text] = `<span style="${entry2StyleString}">${this.entry2Text}</span>`;

        this.highlightedSnippet = this.snippet.replace(new RegExp(`\\b${this.entry1Text}|${this.entry2Text}\\b`, 'g'), match => {
            return styleMap[match];
        });

        // We have to be VERY careful using this! It could expose our site to XSS attacks if we aren't cautious.
        this.trustedHTML = this.domSanitizer.bypassSecurityTrustHtml(this.highlightedSnippet);
    }
}
