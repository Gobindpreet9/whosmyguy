import * as cp from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { GitExtension, Commit, Repository } from './typings/git';
import { BlameInfo } from './BlameInfo';

export class GitManager {
    async getGitBlameInfoForLineRange(filePath: string, startLine: number, endLine: number): Promise<BlameInfo[]> {
        const commitToBlameInfo = new Map<string, BlameInfo>();

        // add 1 to line number because git line count starts at 1
        for (let lineNumber = startLine + 1; lineNumber <= endLine + 1; lineNumber++) {
            const gitLogOutput = await this.executeGitLog(filePath, lineNumber);
            const blameInfoForLine = this.parseGitLogOutput(gitLogOutput, lineNumber);
            blameInfoForLine.forEach(blameInfo => {
                if (commitToBlameInfo.has(blameInfo.commit)) {
                    commitToBlameInfo.get(blameInfo.commit)!.lines.push(lineNumber.toString());
                } else {
                    commitToBlameInfo.set(blameInfo.commit, blameInfo);
                }
            });
        }

        return Array.from(commitToBlameInfo.values()).map(info => ({
            ...info,
            lines: [this.formatLineNumbers(info.lines)]
        }))
        .sort((a, b) => b.date.getTime() - a.date.getTime());    
    }

    async openCommitInGitExtension(commitId: string, filePath: string) {
        const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
        if (!gitExtension) {
            vscode.window.showErrorMessage('Git extension is not available.');
            return;
        }

        const git = gitExtension.exports.getAPI(1);
        const repo = git.repositories[0];
        const commit = await repo.getCommit(commitId);

        if (!commit) {
            vscode.window.showErrorMessage('Commit not found.');
            return;
        }

        await vscode.commands.executeCommand('git.viewCommit', repo, commit.hash);
    } 

    private parseGitLogOutput(output: string, lineNumber: number): BlameInfo[] {
        const commits = output.split('Commit: ').filter(commit => commit.trim() !== '');
        return commits.map(commit => this.parseCommitInfo(commit, lineNumber)).filter((info): info is BlameInfo => info !== null);
    }

    private async executeGitLog(filePath: string, lineNumber: number): Promise<string> {
        const osFilePath = this.convertToOsPath(filePath);
        const repoPath = path.dirname(filePath);
        const command = `git --no-pager log -L ${lineNumber},${lineNumber}:"${osFilePath}" --format="Commit: %H%nAuthor: %an%nAuthor Email: %ae%nDate: %ad%nMessage: %s%n"`;
        return await this.executeCommand(command, repoPath);
    }

    private parseCommitInfo(commitInfo: string, lineNumber: number): BlameInfo | null {
        const lines = commitInfo.trim().split('\n');
        if (lines.length < 5) {  
            return null;
        }
    
        const commit = lines[0].replace('Commit: ', '').trim();
        const author = lines[1].replace('Author: ', '').trim();
        const authorEmail = lines[2].replace('Author Email: ', '').trim();
        const dateString = lines[3].replace('Date: ', '').trim();
        const message = lines[4].replace('Message: ', '').trim();
    
        return {
            lines: [`${lineNumber}`],
            commit,
            author,
            authorEmail,
            date: new Date(dateString),
            message,
        };
    }

    private async executeCommand(command: string, cwd: string): Promise<string> {
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

    private convertToOsPath(windowsPath: string): string {
        if (process.platform === 'win32') {
            return windowsPath.replace(/\\/g, '/');
        }
        // wsl path
        return windowsPath.replace(/^([a-zA-Z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`).replace(/\\/g, '/');
    }

    private formatLineNumbers(lines: string[]): string {
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

    private createHistoryItemFromCommit(commit: Commit): vscode.SourceControlHistoryItem {
        return {
            id: commit.hash,
            parentIds: commit.parents,
            message: commit.message,
            displayId: commit.hash.substr(0, 7),
            author: commit.authorName ? `${commit.authorName} <${commit.authorEmail}>` : undefined,
            timestamp: commit.commitDate ? commit.commitDate.getTime() : undefined,
            statistics: commit.shortStat ? {
                files: commit.shortStat.files,
                insertions: commit.shortStat.insertions,
                deletions: commit.shortStat.deletions
            } : undefined,
            references: []
        };
    }
}