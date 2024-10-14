import * as vscode from 'vscode';
import { BlameInfo } from '../git/BlameInfo';
import { GitManager } from '../git/gitManager';

export class BlamePanel {
    private static readonly HISTORY_MONTHS = 6;
    private panel: vscode.WebviewPanel | undefined;

    constructor(private context: vscode.ExtensionContext) {}
    
    public show(gitManager: GitManager, blameInfo: BlameInfo[], filepath: string) {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Beside);
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'blameInfo',
                'Find Your Guy',
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
                        case 'filterByDate':
                            const filteredBlameInfo = this.filterBlameInfoByDate(blameInfo, message.startDate, message.endDate);
                            if (this.panel) { 
                                this.panel.webview.html = this.getWebviewContent(filteredBlameInfo, message.startDate, message.endDate);
                            }
                            return;
                        case 'openEmail':
                            vscode.env.openExternal(vscode.Uri.parse(`mailto:${message.email}`));
                            return;
                    }
                },
                undefined,
                this.context.subscriptions
            );
        }

        const currentDate = new Date();
        const sixMonthsAgo = new Date(currentDate.setMonth(currentDate.getMonth() - BlamePanel.HISTORY_MONTHS));
        const filteredBlameInfo = this.filterBlameInfoByDate(blameInfo, sixMonthsAgo.toISOString());
        this.panel.webview.html = this.getWebviewContent(filteredBlameInfo, this.formatDateToYYYYMMDD(sixMonthsAgo));
    }

    private getWebviewContent(blameInfo: BlameInfo[], startDate?: string, endDate?: string): string {
        const tableRows = blameInfo.map((info) => `
            <tr>
                <td><a href="#" onclick="openCommit('${info.commit}')">${info.commit.substring(0, 7)}</a></td>
                <td>
                    <span class="author-name" title="${info.authorEmail}" onclick="openEmail('${info.authorEmail}')">${info.author}</span>
                </td>
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

                .filter-container {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                    padding: 10px;
                    background-color: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                }

                .date-inputs {
                    display: flex;
                    gap: 10px;
                }

                .input-group {
                    display: flex;
                    flex-direction: column;
                }

                .input-group label {
                    margin-bottom: 5px;
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                }

                input[type="date"] {
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    padding: 4px 8px;
                    font-size: 13px;
                    border-radius: 2px;
                }

                .button-group {
                    display: flex;
                    gap: 10px;
                }

                button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 6px 12px;
                    font-size: 13px;
                    cursor: pointer;
                    border-radius: 2px;
                }

                button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }

                hr {
                    border: none;
                    border-top: 1px solid var(--vscode-panel-border);
                    margin: 15px 0;
                }
                
                .author-name {
                    cursor: pointer;
                    position: relative;
                }

                .author-name:hover::after {
                    content: attr(title);
                    position: absolute;
                    bottom: 100%;
                    left: 50%;
                    transform: translateX(-50%);
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-foreground);
                    padding: 5px;
                    border-radius: 3px;
                    border: 1px solid var(--vscode-panel-border);
                    white-space: nowrap;
                    z-index: 1;
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
    
                function filterByDate() {
                    const startDate = document.getElementById('startDate').value;
                    const endDate = document.getElementById('endDate').value;
                    vscode.postMessage({
                        command: 'filterByDate',
                        startDate: startDate,
                        endDate: endDate
                    });
                }

                function clearDatesFilter() {
                    document.getElementById('startDate').value = '';
                    document.getElementById('endDate').value = '';
                    vscode.postMessage({
                        command: 'filterByDate',
                        startDate: '',
                        endDate: ''
                    });
                }

                function openEmail(email) {
                    vscode.postMessage({
                        command: 'openEmail',
                        email: email
                    });
                }    
            </script>
        </head>
        <body>
            <div class="filter-container">
                <div class="date-inputs">
                    <div class="input-group">
                        <label for="startDate">Start Date:</label>
                        <input type="date" id="startDate" name="startDate" value="${startDate || ''}">
                    </div>
                    <div class="input-group">
                        <label for="endDate">End Date:</label>
                        <input type="date" id="endDate" name="endDate" value="${endDate || ''}">
                    </div>
                </div>
                <div class="button-group">
                    <button onclick="filterByDate()">Filter</button>
                    <button onclick="clearDatesFilter()">Clear</button>
                </div>
            </div>
            <hr>
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

    private formatDateToYYYYMMDD(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    private filterBlameInfoByDate(blameInfo: BlameInfo[], startDate?: string, endDate?: string): BlameInfo[] {
        const start = startDate ? new Date(startDate) : new Date(0);
        const end = endDate ? new Date(endDate) : new Date();
    
        return blameInfo.filter(info => {
            const infoDate = new Date(info.date);
            return infoDate >= start && infoDate <= end;
        });
    }
}