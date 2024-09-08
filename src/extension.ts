import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';

interface BlameInfo {
    line: number;
    commit: string;
    author: string;
    date: string;
    message: string;
}

function convertToWslPath(windowsPath: string): string {
    return windowsPath.replace(/^([a-zA-Z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`).replace(/\\/g, '/');
}

function executeGitBlame(filePath: string, startLine: number, endLine: number): Promise<string> {
    return new Promise((resolve, reject) => {
        const wslFilePath = convertToWslPath(filePath);
        const repoPath = path.dirname(filePath); // Directory where the .git folder is
        const command = `git blame -L ${startLine + 1},${endLine + 1} -- "${wslFilePath}"`;
        console.log(`Executing command: ${command}`);
         
        cp.exec(command, { cwd: repoPath }, (error, stdout, stderr) => {
            if (error) {
                reject(stderr || error.message);
            } else {
                resolve(stdout);
            }
        });
    });
}

function parseGitBlame(blameOutput: string): BlameInfo[] {
    const blameLines = blameOutput.split('\n').filter(line => line.trim() !== '');
    const blameInfoArray: BlameInfo[] = [];

    const blameRegex = /^\^([a-f0-9]+) \(([^)]+) (\d{4}-\d{2}-\d{2})[^)]*\s+(\d+)\)\s+(.*)$/;

    for (const line of blameLines) {
        const match = blameRegex.exec(line);
        if (match) {
            const [, commit, author, date, lineNumber, message] = match;

            const blameInfo: BlameInfo = {
                line: parseInt(lineNumber, 10),
                commit: commit.replace('^', ''),
                author: author.trim(),
                date,
                message: message.trim(),
            };

            blameInfoArray.push(blameInfo);
        }
    }

    return blameInfoArray;
}

export function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "whosmyguy" is now active!');

	const disposable = vscode.commands.registerCommand('whosmyguy.findGuy', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			console.error('No active editor');
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

            // Collect blame information for each selected line
            const blameOutput = await executeGitBlame(filePath, startLine, endLine);
            const blameInfo = parseGitBlame(blameOutput);
            console.log(blameInfo);
            
            vscode.window.showInformationMessage(`Showing blame for lines ${startLine + 1} to ${endLine + 1}.`);
        } catch (error) {
            vscode.window.showErrorMessage(`Error getting git blame: ${error instanceof Error ? error.message : String(error)}`);
        }
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
