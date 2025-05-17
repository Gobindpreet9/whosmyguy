import * as vscode from 'vscode';
import { BlameInfo } from '../git/BlameInfo';
import { BlameTreeItem } from './BlameTreeItem';

export class BlameTreeDataProvider implements vscode.TreeDataProvider<BlameTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<BlameTreeItem | undefined | null | void> = new vscode.EventEmitter<BlameTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<BlameTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private blameData: BlameInfo[] = [];
    private startDate?: Date;
    private endDate?: Date;
    private currentDateFilter: string = 'last6Months'; // default filter
    private filepath: string = '';
    
    constructor() {}

    refresh(blameInfo?: BlameInfo[], startDate?: Date, endDate?: Date, filepath?: string): void {
        this.blameData = blameInfo || this.blameData;
        this.startDate = startDate || this.startDate;
        this.endDate = endDate || this.endDate;
        this.filepath = filepath || this.filepath;
        this._onDidChangeTreeData.fire();
    }

    setDateFilter(filter: string): void {
        this.currentDateFilter = filter;
        
        const now = new Date();
        
        switch(filter) {
            case 'allTime':
                this.startDate = undefined;
                this.endDate = undefined;
                break;
            case 'today':
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                this.startDate = today;
                this.endDate = now;
                break;
            case 'thisWeek':
                const thisWeekStart = new Date();
                thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
                thisWeekStart.setHours(0, 0, 0, 0);
                this.startDate = thisWeekStart;
                this.endDate = now;
                break;
            case 'thisMonth':
                const thisMonthStart = new Date();
                thisMonthStart.setDate(1);
                thisMonthStart.setHours(0, 0, 0, 0);
                this.startDate = thisMonthStart;
                this.endDate = now;
                break;
            case 'last6Months':
                const sixMonthsAgo = new Date();
                sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                this.startDate = sixMonthsAgo;
                this.endDate = now;
                break;
            case 'custom':
                // Keep current custom dates
                break;
        }
        
        this._onDidChangeTreeData.fire();
    }
    
    setCustomDateRange(startDate: string, endDate: string): void {
        this.currentDateFilter = 'custom';
        this.startDate = new Date(startDate);
        this.endDate = new Date(endDate);
        this._onDidChangeTreeData.fire();
    }

    getFilteredData(): BlameInfo[] {
        if (!this.startDate && !this.endDate) {
            return this.blameData;
        }

        const start = this.startDate || new Date(0);
        const end = this.endDate || new Date();

        return this.blameData.filter(info => {
            const commitDate = new Date(info.date);
            return commitDate >= start && commitDate <= end;
        });
    }

    getTreeItem(element: BlameTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: BlameTreeItem): Thenable<BlameTreeItem[]> {
        if (!element) {
            if (this.blameData.length === 0) {
                return Promise.resolve([
                    new BlameTreeItem(
                        'Welcome',
                        vscode.TreeItemCollapsibleState.None,
                        undefined, undefined, undefined, undefined,
                        'View and analyze git history for your selected code', undefined, true
                    ),
                    new BlameTreeItem(
                        '1. Select code in the editor',
                        vscode.TreeItemCollapsibleState.None
                    ),
                    new BlameTreeItem(
                        '2. Right-click and select "Who\'s My Guy?"',
                        vscode.TreeItemCollapsibleState.None
                    ),
                    new BlameTreeItem(
                        '3. View commit history (last 6 months by default)',
                        vscode.TreeItemCollapsibleState.None
                    ),
                    new BlameTreeItem(
                        '4. Use the filter button to change date range',
                        vscode.TreeItemCollapsibleState.None
                    )
                ]);
            }
            
            const filteredData = this.getFilteredData();
            if (filteredData.length === 0) {
                return Promise.resolve([new BlameTreeItem(
                    'No commits found in the selected date range',
                    vscode.TreeItemCollapsibleState.None,
                    undefined, undefined, undefined, undefined,
                    'Try selecting a different date range or clear the filter to see all commits'
                )]);
            }

            return Promise.resolve(filteredData.map(info => {
                const lineInfo = info.lines.length > 0 ? `[Lines: ${info.lines.join(', ')}]` : '';
                const label = `${info.commit.substring(0, 7)} - ${lineInfo} ${info.message.split('\n')[0]}`;
                const tooltip = `${info.author} • ${this.formatDate(info.date)}\nLines: ${info.lines.join(', ')}`;
                
                const item = new BlameTreeItem(
                    label, 
                    vscode.TreeItemCollapsibleState.Collapsed,
                    info.commit, undefined, info.date, undefined, 
                    tooltip, info.lines, false, this.filepath
                );
                item.iconPath = new vscode.ThemeIcon('git-commit');
                return item;
            }));
        } else if (element.commit) {
            const commitInfo = this.blameData.find(info => info.commit === element.commit);
            if (!commitInfo) { return Promise.resolve([]); }
            
            return Promise.resolve([
                new BlameTreeItem(
                    `Author: ${commitInfo.author}`,
                    vscode.TreeItemCollapsibleState.None,
                    undefined, commitInfo.authorEmail, undefined, 'whosmyguy.openEmail',
                    `Click to email: ${commitInfo.authorEmail}`,
                    undefined, false, this.filepath
                ),
                (() => {
                    const item = new BlameTreeItem(
                        `Commit: ${commitInfo.commit.substring(0, 7)}`,
                        vscode.TreeItemCollapsibleState.None,
                        commitInfo.commit, undefined, undefined, 'whosmyguy.openCommit',
                        'Click to open commit details',
                        undefined, false, this.filepath
                    );
                    item.iconPath = new vscode.ThemeIcon('go-to-file');
                    item.description = 'View';
                    return item;
                })(),
                new BlameTreeItem(
                    `Date: ${this.formatDate(commitInfo.date)}`,
                    vscode.TreeItemCollapsibleState.None,
                    undefined, undefined, commitInfo.date
                ),
                new BlameTreeItem(
                    `Lines: ${commitInfo.lines.join(', ')}`,
                    vscode.TreeItemCollapsibleState.None,
                    undefined, undefined, undefined, undefined, undefined,
                    commitInfo.lines
                )
            ]);
        }
        
        return Promise.resolve([]);
    }

    private formatDate(date: Date): string {
        const now = new Date();
        const diffMinutes = Math.floor((now.getTime() - new Date(date).getTime()) / (1000 * 60));

        if (diffMinutes < 60) {
            return `${diffMinutes} minute(s) ago`;
        } else if (diffMinutes < 1440) {
            const hours = Math.floor(diffMinutes / 60);
            return `${hours} hour(s) ago`;
        } else {
            return `${new Date(date).toLocaleDateString()}`;
        }
    }

    getCurrentDateFilter(): string {
        return this.currentDateFilter;
    }
    
    getStartDate(): Date | undefined {
        return this.startDate;
    }
    
    getEndDate(): Date | undefined {
        return this.endDate;
    }
}
