import * as vscode from 'vscode';
import { BlamePanel } from './views/blamePanel';
import { GitManager } from './git/gitManager';

let panel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
    const blamePanel = new BlamePanel(context);
    const gitManager = new GitManager();

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

            const blameInfo = await gitManager.getGitBlameInfo(filePath, startLine, endLine);
            
            if (blameInfo.length > 0) {
                blamePanel.show(gitManager, blameInfo, filePath);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error getting git blame: ${error instanceof Error ? error.message : String(error)}`);
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}