import * as vscode from 'vscode';
import { BlameView } from './views/blameView';
import { GitManager } from './git/gitManager';

const TITLE_PREFERENCE_KEY = 'whosmyguy.titlePreference'; // 'guy' or 'gal'
const DEFAULT_TITLE_PREFERENCE = 'guy';

export function activate(context: vscode.ExtensionContext) {
    const blameView = new BlameView(context);
    const gitManager = new GitManager();

    const findBlameCoreLogic = async () => {
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
            const lineCount = document.lineCount;

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
                
                const blameInfo = await gitManager.getGitBlameInfoForLineRange(filePath, startLine, endLine, lineCount);
                
                if (blameInfo.length > 0) {
                    blameView.show(gitManager, blameInfo, filePath);
                } else {
                    vscode.window.showInformationMessage("No git history found for the selected lines. This could mean the lines are uncommitted changes, the file is new, or not tracked by git.");
                }
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Error getting git blame: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    // Register the 'findGuy' and 'findGal' commands to the same core logic
    const findGuyDisposable = vscode.commands.registerCommand('whosmyguy.findGuy', findBlameCoreLogic);
    context.subscriptions.push(findGuyDisposable);

    const findGalDisposable = vscode.commands.registerCommand('whosmyguy.findGal', findBlameCoreLogic);
    context.subscriptions.push(findGalDisposable);

    const toggleTitlePreferenceDisposable = vscode.commands.registerCommand('whosmyguy.toggleTitlePreference', async () => {
        const currentPreference = context.globalState.get<string>(TITLE_PREFERENCE_KEY, DEFAULT_TITLE_PREFERENCE);
        const newPreference = currentPreference === 'guy' ? 'gal' : 'guy';
        await context.globalState.update(TITLE_PREFERENCE_KEY, newPreference);
        vscode.commands.executeCommand('setContext', TITLE_PREFERENCE_KEY, newPreference);
        vscode.window.showInformationMessage(`Context menu title preference switched to: ${newPreference === 'guy' ? "Who's My Guy?" : "Who's My Gal?"}`);
    });
    context.subscriptions.push(toggleTitlePreferenceDisposable);

    const initialPreference = context.globalState.get<string>(TITLE_PREFERENCE_KEY, DEFAULT_TITLE_PREFERENCE);
    vscode.commands.executeCommand('setContext', TITLE_PREFERENCE_KEY, initialPreference);
}

export function deactivate() {}