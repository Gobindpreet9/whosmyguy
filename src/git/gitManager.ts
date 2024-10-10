import * as cp from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { GitExtension, Commit, Repository } from './typings/git';
import { BlameInfo } from './BlameInfo';

export class GitManager {
    async getGitBlameInfo(filePath: string, startLine: number, endLine: number): Promise<BlameInfo[]> {
        const blameOutput = await this.executeGitBlame(filePath, startLine, endLine);
        const blameInfo = this.parseGitBlame(blameOutput);
        await this.addCommitMessagesToBlameInfo(filePath, blameInfo);
        return blameInfo;
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

        const historyItem = this.createHistoryItemFromCommit(commit);
        const doesFileExistInParents = await this.doesFileExistInParents(repo, commit, filePath);

        if (doesFileExistInParents) {
            await vscode.commands.executeCommand('git.viewCommit', repo, historyItem);
        } 
        else {
            vscode.window.showErrorMessage(`Unable to view change history for '${commitId}'. No parent commit exists.`);
        }
    }

    async doesFileExistInParents(repo: Repository, commit: Commit, filePath: string): Promise<boolean> {
        if (commit.parents.length === 0) {
            return false;
        }

        try {
            const result = await repo.show(commit.parents[0], filePath);
            return result !== '';
        } catch (error) {
            return false;
        }
    }

    private async executeGitBlame(filePath: string, startLine: number, endLine: number): Promise<string> {
        const wslFilePath = this.convertToWslPath(filePath);
        const repoPath = path.dirname(filePath);
        const command = `git blame -L ${startLine + 1},${endLine + 1} -- "${wslFilePath}"`;
        return await this.executeCommand(command, repoPath);
    }

    private parseGitBlame(blameOutput: string): BlameInfo[] {
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
                    date: this.formatDate(date),
                    lineContent: lineContent.trim(),
                    message: "",
                };
                blameInfoArray.push(blameInfo);
            }
        }
    
        return this.mergeBlameInfo(blameInfoArray);
    }

    private mergeBlameInfo(blameInfoArray: BlameInfo[]): BlameInfo[] {
        const commitToBlameInfo = new Map<string, BlameInfo>();

        for (const blameInfo of blameInfoArray) {
            if (commitToBlameInfo.has(blameInfo.commit)) {
                const existingInfo = commitToBlameInfo.get(blameInfo.commit)!;
                existingInfo.lines.push(...blameInfo.lines);
                existingInfo.lineContent += `\n${blameInfo.lineContent}`;
            } else {
                commitToBlameInfo.set(blameInfo.commit, { ...blameInfo });
            }
        }

        return Array.from(commitToBlameInfo.values()).map(info => ({
            ...info,
            lines: [this.formatLineNumbers(info.lines)]
        }));
    }

    private async addCommitMessagesToBlameInfo(filePath: string, blameInfoArray: BlameInfo[]): Promise<void> {
        const repoPath = path.dirname(filePath);
        const commitMessages = new Map<string, string>();

        for (const blameInfo of blameInfoArray) {
            if (!commitMessages.has(blameInfo.commit)) {
                const command = `git show -s --format=%B ${blameInfo.commit}`;
                commitMessages.set(blameInfo.commit, await this.executeCommand(command, repoPath));
            }
            blameInfo.message = commitMessages.get(blameInfo.commit)?.trim() || "";
        }
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

    private convertToWslPath(windowsPath: string): string {
        return windowsPath.replace(/^([a-zA-Z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`).replace(/\\/g, '/');
    }

    private formatDate(dateString: string): string {
        const date = new Date(dateString);
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