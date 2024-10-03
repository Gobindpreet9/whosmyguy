import * as vscode from 'vscode';
import { BlameInfo, executeGitBlame, parseGitBlame, addCommitMessagesToBlameInfo } from './utils/utils';

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

            const blameOutput = await executeGitBlame(filePath, startLine, endLine);
            const blameInfo = parseGitBlame(blameOutput);
            await addCommitMessagesToBlameInfo(filePath, blameInfo);

            if (blameInfo.length > 0) {
                const hoverContent = createHoverContent(blameInfo, startLine);

                const decorationType = vscode.window.createTextEditorDecorationType({
                    backgroundColor: new vscode.ThemeColor('editor.hoverHighlightBackground'),
                    isWholeLine: true
                });

                const range = new vscode.Range(selection.start, selection.end);
                editor.setDecorations(decorationType, [range]);

                // Register a hover provider for all documents
                const hoverProviderDisposable = vscode.languages.registerHoverProvider(
                    "*",
                    {
                        provideHover(document, position, token) {
                            return new vscode.Hover(hoverContent, new vscode.Range(position, position));
                        }
                    }
                );

                context.subscriptions.push(hoverProviderDisposable);

                // Clear decoration and hover provider after a delay
                setTimeout(() => {
                    hoverProviderDisposable.dispose();
                    decorationType.dispose();
                    editor.setDecorations(decorationType, []);
                }, 10000);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error getting git blame: ${error instanceof Error ? error.message : String(error)}`);
        }
    });

    context.subscriptions.push(disposable);
}

function createHoverContent(blameInfo: BlameInfo[], startLine: number): vscode.MarkdownString {
    const hoverContent = new vscode.MarkdownString();

    // Create HTML table with proper Markdown separation
    hoverContent.appendMarkdown(`
<table style="border-collapse: collapse; width: 100%;">
<thead>
<tr style="background-color: #f2f2f2;">
<th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Line #</th>
<th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Author</th>
<th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Date</th>
<th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Message</th>
</tr>
</thead>
<tbody>
${blameInfo.map((info, index) => `
<tr>
<td style="border: 1px solid #ddd; padding: 8px;">${startLine + index + 1}</td>
<td style="border: 1px solid #ddd; padding: 8px;">${info.author}</td>
<td style="border: 1px solid #ddd; padding: 8px;">${formatDate(info.date)}</td>
<td style="border: 1px solid #ddd; padding: 8px;">${info.message}</td>
</tr>
`).join('')}
</tbody>
</table>
`);

    hoverContent.isTrusted = true;
    hoverContent.supportHtml = true;
    
    return hoverContent;
}

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffMinutes < 60) {
        return `${diffMinutes} minutes ago`;
    } else if (diffMinutes < 1440) {
        const hours = Math.floor(diffMinutes / 60);
        return `${hours} hours ago`;
    } else {
        return `${date.toLocaleDateString()}`;
    }
}

export function deactivate() {}
