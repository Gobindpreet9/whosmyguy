import * as vscode from 'vscode';
import { BlameInfo, getGitBlameInfo } from './utils/utils';

let panel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('whosmyguy.findGuy', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found.');
            return;
        }

        const document = editor.document;
        const selection = editor.selection;
        const uri = document.uri;

        try {
            const startLine = selection.start.line;
            const endLine = selection.end.line;

            const filePath = uri.fsPath;
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);

            if (!workspaceFolder) {
                throw new Error('File is not part of a workspace');
            }

            const blameInfo = await getGitBlameInfo(filePath, startLine, endLine);

            if (blameInfo.length > 0) {
                showBlamePanel(context.extensionUri, blameInfo, startLine);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error getting git blame: ${error instanceof Error ? error.message : String(error)}`);
        }
    });

    context.subscriptions.push(disposable);
}

function showBlamePanel(extensionUri: vscode.Uri, blameInfo: BlameInfo[], startLine: number) {
    if (panel) {
        panel.reveal(vscode.ViewColumn.Beside);
    } else {
        panel = vscode.window.createWebviewPanel(
            'blameInfo',
            'Git Blame Info',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: [extensionUri]
            }
        );

        panel.onDidDispose(() => {
            panel = undefined;
        }, null, []);
    }

    panel.webview.html = getWebviewContent(blameInfo);
}

function getWebviewContent(blameInfo: BlameInfo[]): string {
    const tableRows = blameInfo.map((info) => `
        <tr>
            <td>${info.commit.substring(0, 7)}</td>
            <td>${info.author}</td>
            <td>${info.date}</td>
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
            <title>Git Blame Info</title>
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
            </style>
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

export function deactivate() {}