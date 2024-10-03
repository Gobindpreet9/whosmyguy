import * as cp from 'child_process';
import * as path from 'path';

export interface BlameInfo {
    line: number;
    commit: string;
    author: string;
    date: string;
    message: string;
    lineContent: string;
}

export function convertToWslPath(windowsPath: string): string {
    return windowsPath.replace(/^([a-zA-Z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`).replace(/\\/g, '/');
}

function executeCommand(command: string, cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
        console.log(`Executing command: ${command}`);
        cp.exec(command, { cwd }, (error, stdout, stderr) => {
            if (error) {
                reject(stderr || error.message);
            } else {
                resolve(stdout);
            }
        });
    });
}

export async function executeGitBlame(filePath: string, startLine: number, endLine: number): Promise<string> {
    const wslFilePath = convertToWslPath(filePath);
    const repoPath = path.dirname(filePath); // Directory where the .git folder is
    const command = `git blame -L ${startLine + 1},${endLine + 1} -- "${wslFilePath}"`;

    return await executeCommand(command, repoPath);
}

export function parseGitBlame(blameOutput: string): BlameInfo[] {
    const blameLines = blameOutput.split('\n').filter(line => line.trim() !== '');
    const blameInfoArray: BlameInfo[] = [];

    const blameRegex = /^\^([a-f0-9]+) \(([^)]+) (\d{4}-\d{2}-\d{2})[^)]*\s+(\d+)\)\s+(.*)$/;

    for (const line of blameLines) {
        const match = blameRegex.exec(line);
        if (match) {
            const [, commit, author, date, lineNumber, line] = match;

            var blameInfo: BlameInfo = {
                line: parseInt(lineNumber, 10),
                commit: commit.replace('^', ''),
                author: author.trim(),
                date,
                lineContent: line.trim(),
                message: "",
            };
            blameInfoArray.push(blameInfo);
        }
    }

    return blameInfoArray;
}

export async function addCommitMessagesToBlameInfo(filePath: string, blameInfoArray: BlameInfo[]): Promise<void> {
    const commitMessages: { [commitId: string]: string } = {};
    const repoPath = path.dirname(filePath); // Directory where the .git folder is

    for (const blameInfo of blameInfoArray) {
        if (!commitMessages[blameInfo.commit]) {
            const command = `git show -s --format=%B ${blameInfo.commit}`;
            commitMessages[blameInfo.commit] = await executeCommand(command, repoPath);
        }

        blameInfo.message = commitMessages[blameInfo.commit].trim();
    }
}