import * as cp from 'child_process';
import * as path from 'path';

export interface BlameInfo {
    lines: string[];        // Changed from single 'line' to an array of line numbers
    commit: string;
    author: string;
    date: string;
    message: string;
    lineContent: string;
}

export async function getGitBlameInfo(filePath: string, startLine: number, endLine: number): Promise<BlameInfo[]> {
    const blameOutput = await executeGitBlame(filePath, startLine, endLine);
    const blameInfo = parseGitBlame(blameOutput);
    await addCommitMessagesToBlameInfo(filePath, blameInfo);
    return blameInfo;
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

async function executeGitBlame(filePath: string, startLine: number, endLine: number): Promise<string> {
    const wslFilePath = convertToWslPath(filePath);
    const repoPath = path.dirname(filePath); // Directory where the .git folder is
    const command = `git blame -L ${startLine + 1},${endLine + 1} -- "${wslFilePath}"`;

    return await executeCommand(command, repoPath);
}

function parseGitBlame(blameOutput: string): BlameInfo[] {
    const blameLines = blameOutput.split('\n').filter(line => line.trim() !== '');
    const blameInfoArray: BlameInfo[] = [];

    const blameRegex = /^(\^?[a-f0-9]+)\s+\(([^)]+)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+[+-]\d{4})\s+(\d+)\)\s+(.*)$/;

    for (const line of blameLines) {
        const match = blameRegex.exec(line);
        if (match) {
            const [, commit, author, date, lineNumber, lineContent] = match;

            const blameInfo: BlameInfo = {
                lines: [lineNumber],
                commit: commit.replace('^', ''),
                author: author.trim(),
                date: formatDate(date),
                lineContent: lineContent.trim(),
                message: "",
            };
            blameInfoArray.push(blameInfo);
        }
    }

    return mergeBlameInfo(blameInfoArray);
}

function formatLineNumbers(lines: string[]): string {
    const sortedLines = lines.map(Number).sort((a, b) => a - b);
    const ranges: string[] = [];
    let start = sortedLines[0];
    let end = sortedLines[0];

    for (let i = 1; i <= sortedLines.length; i++) {
        if (i < sortedLines.length && sortedLines[i] === end + 1) {
            end = sortedLines[i];
        } else {
            ranges.push(start === end ? start.toString() : `${start}-${end}`);
            if (i < sortedLines.length) {
                start = sortedLines[i];
                end = sortedLines[i];
            }
        }
    }

    return ranges.join(', ');
}

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffMinutes < 60) {
        return `${diffMinutes} minutes ago`;
    } else if (diffMinutes < 1440) {
        const hours = Math.floor(diffMinutes / 60);
        return `${hours} hour(s) ago`;
    } else {
        return `${date.toLocaleDateString()}`;
    }
}

function mergeBlameInfo(blameInfoArray: BlameInfo[]): BlameInfo[] {
    const mergedMap: { [commitId: string]: BlameInfo } = {};

    for (const blameInfo of blameInfoArray) {
        if (mergedMap[blameInfo.commit]) {
            // Merge lines and content for the same commit
            const existingInfo = mergedMap[blameInfo.commit];
            existingInfo.lines = [...existingInfo.lines, ...blameInfo.lines]; // Combine line numbers
            existingInfo.lineContent += `\n${blameInfo.lineContent}`;         // Concatenate line content
        } else {
            mergedMap[blameInfo.commit] = { ...blameInfo };  // Create new entry for this commit
        }
    }

    for (const commitId in mergedMap) {
        mergedMap[commitId].lines = [formatLineNumbers(mergedMap[commitId].lines)];
    }

    return Object.values(mergedMap);
}

async function addCommitMessagesToBlameInfo(filePath: string, blameInfoArray: BlameInfo[]): Promise<void> {
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
