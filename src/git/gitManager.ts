import * as cp from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { GitExtension } from './typings/git';
import { BlameInfo } from './BlameInfo';

export class GitManager {
    async getGitBlameInfoForLineRange(filePath: string, startLine: number, endLine: number, lineCount: number): Promise<BlameInfo[]> {
        const commitToBlameInfo = new Map<string, BlameInfo>();
        
        const hasUncommitted = await this.hasUncommittedChanges(filePath);
        const committedLineCount = hasUncommitted ? await this.getCommittedLineCount(filePath) : lineCount;
        
        const uncommittedLines: number[] = [];

        for (let lineNumber = startLine + 1; lineNumber <= endLine + 1; lineNumber++) {
            if (lineNumber > lineCount) {
                break;
            }
            
            if (hasUncommitted && lineNumber > committedLineCount) {
                uncommittedLines.push(lineNumber);
                continue;
            }
            
            try {
                const gitLogOutput = await this.executeGitLog(filePath, lineNumber);
                const blameInfoForLine = this.parseGitLogOutput(gitLogOutput, lineNumber);
                blameInfoForLine.forEach(blameInfo => {
                    if (commitToBlameInfo.has(blameInfo.commit)) {
                        commitToBlameInfo.get(blameInfo.commit)!.lines.push(lineNumber.toString());
                    } else {
                        commitToBlameInfo.set(blameInfo.commit, blameInfo);
                    }
                });
            } catch (error) {
                console.warn(`Could not get blame info for line ${lineNumber}: ${error}`);
                uncommittedLines.push(lineNumber);
            }
        }
        
        if (uncommittedLines.length > 0) {
            const uncommittedInfo: BlameInfo = {
                lines: uncommittedLines.map(line => line.toString()),
                commit: 'uncommitted',
                author: 'You',
                authorEmail: 'local',
                date: new Date(),
                message: 'Uncommitted changes'
            };
            commitToBlameInfo.set('uncommitted', uncommittedInfo);
        }

        return Array.from(commitToBlameInfo.values()).map(info => ({
            ...info,
            lines: [this.formatLineNumbers(info.lines)]
        }))
        .sort((a, b) => {
            // Put uncommitted changes at the top
            if (a.commit === 'uncommitted') { return -1; }
            if (b.commit === 'uncommitted') { return 1; }
            return b.date.getTime() - a.date.getTime();
        });    
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
        const repoRoot = await this.getGitRepoRoot(filePath);
        const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, '/');
        const command = `git --no-pager log -L ${lineNumber},${lineNumber}:"${relativePath}" --format="Commit: %H%nAuthor: %an%nAuthor Email: %ae%nDate: %ad%nMessage: %s%n"`;
        return await this.executeCommand(command, repoRoot);
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

    private async getGitRepoRoot(filePath: string): Promise<string> {
        try {
            const command = 'git rev-parse --show-toplevel';
            const output = await this.executeCommand(command, path.dirname(filePath));
            return output.trim().replace(/\//g, path.sep);
        } catch (error) {
            console.error('Error finding git repo root:', error);
            return path.dirname(filePath);
        }
    }

    private async hasUncommittedChanges(filePath: string): Promise<boolean> {
        try {
            const repoRoot = await this.getGitRepoRoot(filePath);
            const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, '/');
            const command = `git status --porcelain "${relativePath}"`;
            const output = await this.executeCommand(command, repoRoot);
            return output.trim().length > 0;
        } catch (error) {
            console.error('Error checking uncommitted changes:', error);
            return false;
        }
    }

    private async getCommittedLineCount(filePath: string): Promise<number> {
        try {
            const repoRoot = await this.getGitRepoRoot(filePath);
            const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, '/');
            const command = `git show HEAD:"${relativePath}"`;
            const output = await this.executeCommand(command, repoRoot);
            // Count lines manually to avoid platform-specific commands
            const lines = output.split('\n');
            // Remove empty last line if it exists (common with git show)
            return lines.length > 0 && lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
        } catch (error) {
            console.error('Error getting committed line count:', error);
            return 0;
        }
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
}