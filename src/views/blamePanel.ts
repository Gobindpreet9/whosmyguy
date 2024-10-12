import * as vscode from 'vscode';
import { BlameInfo } from '../git/BlameInfo';
import { GitManager } from '../git/gitManager';

export class BlamePanel {
    private panel: vscode.WebviewPanel | undefined;

    constructor(private context: vscode.ExtensionContext) {}

    public show(gitManager: GitManager, blameInfo: BlameInfo[], filepath: string) {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Beside);
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'blameInfo',
                'Git Blame Info',
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    localResourceRoots: [this.context.extensionUri]
                }
            );

            this.panel.onDidDispose(() => {
                this.panel = undefined;
            }, null, this.context.subscriptions);

            this.panel.webview.onDidReceiveMessage(
                async message => {
                    switch (message.command) {
                        case 'openCommit':
                            gitManager.openCommitInGitExtension(message.commit, filepath);
                            return;
                    }
                },
                undefined,
                this.context.subscriptions
            );
        }

        this.panel.webview.html = this.getWebviewContent(blameInfo);
    }

    private getWebviewContent(blameInfo: BlameInfo[]): string {
        const tableRows = blameInfo.map((info) => `
            <tr>
                <td><a href="#" onclick="openCommit('${info.commit}')">${info.commit.substring(0, 7)}</a></td>
                <td>${info.author}</td>
                <td>${this.formatDate(info.date)}</td>
                <td>${info.message}</td>
                <td>${info.lines.join(', ')}</td>
            </tr>
        `).join('');
    
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Find Your Guy</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                }
                table {
                    border-collapse: collapse;
                    width: 100%;
                }
                th, td {
                    border: 1px solid var(--vscode-panel-border);
                    padding: 8px;
                    text-align: left;
                }
                th {
                    background-color: var(--vscode-editor-foreground);
                    color: var(--vscode-editor-background);
                    font-weight: bold;
                }
                a {
                    color: var(--vscode-textLink-foreground);
                    text-decoration: none;
                }
                a:hover {
                    text-decoration: underline;
                }
            </style>
            <script>
                const vscode = acquireVsCodeApi();
                function openCommit(commitId) {
                    vscode.postMessage({
                        command: 'openCommit',
                        commit: commitId
                    });
                }
            </script>
        </head>
        <body>
            <table>
                <tr>
                    <th>Commit ID</th>
                    <th>Author</th>
                    <th>Date</th>
                    <th>Commit Message</th>
                    <th>Line(s)</th>
                </tr>
                ${tableRows}
            </table>
        </body>
        </html>
        `;
    }

    private formatDate(date: Date): string {
        const now = new Date();
        const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

        if (diffMinutes < 60) {
            return `${diffMinutes} minute(s) ago`;
        } else if (diffMinutes < 1440) {
            const hours = Math.floor(diffMinutes / 60);
            return `${hours} hour(s) ago`;
        } else {
            return `${date.toLocaleDateString()}`;
        }
    }
}