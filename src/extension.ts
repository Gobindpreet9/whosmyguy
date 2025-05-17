import * as vscode from 'vscode';
import { BlameView } from './views/blameView';
import { GitManager } from './git/gitManager';

export function activate(context: vscode.ExtensionContext) {
    const blameView = new BlameView(context);
    const gitManager = new GitManager();

    const disposable = vscode.commands.registerCommand('whosmyguy.findGuy', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active  editor found.');
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
                vscode.window.showErrorMessage('File is not part of a workspace. Cannot determine repository path.');
                return; 
            }

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                cancellable: false 
            }, async (progress) => {
                progress.report({ message: "Analyzing git history..." });
                
                const blameInfo = await gitManager.getGitBlameInfoForLineRange(filePath, startLine, endLine);
                
                if (blameInfo.length > 0) {
                    blameView.show(gitManager, blameInfo, filePath);
                } else {
                    vscode.window.showInformationMessage("No git history found for the selected lines (lines might be uncommitted or file is new).");
                }
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Error getting git blame: ${error instanceof Error ? error.message : String(error)}`);
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}