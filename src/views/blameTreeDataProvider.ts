import * as vscode from 'vscode';
import { BlameInfo } from '../git/BlameInfo';
import { BlameTreeItem } from './BlameTreeItem';
import { DateFilterType, DateRange, formatRelativeDate as formatDate, getDateRange } from '../utils/dateUtils';

export class BlameTreeDataProvider implements vscode.TreeDataProvider<BlameTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<BlameTreeItem | undefined | null | void> = new vscode.EventEmitter<BlameTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<BlameTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private blameData: BlameInfo[] = [];
    private dateRange: DateRange = {};
    private currentDateFilter: DateFilterType = DateFilterType.LAST_6_MONTHS; // default filter
    private filepath: string = '';
    
    constructor() {}

    refresh(blameInfo?: BlameInfo[], startDate?: Date, endDate?: Date, filepath?: string): void {
        this.blameData = blameInfo || this.blameData;
        this.dateRange = { startDate, endDate };
        this.filepath = filepath || this.filepath;
        this._onDidChangeTreeData.fire();
    }

    setDateFilter(filter: DateFilterType): void {
        this.currentDateFilter = filter;
        this.dateRange = getDateRange(filter);
        this._onDidChangeTreeData.fire();
    }
    
    setCustomDateRange(startDate: string, endDate: string): void {
        this.currentDateFilter = DateFilterType.CUSTOM;
        this.dateRange = getDateRange(DateFilterType.CUSTOM, startDate, endDate);
        this._onDidChangeTreeData.fire();
    }

    getFilteredData(): BlameInfo[] {
        if (!this.dateRange.startDate && !this.dateRange.endDate) {
            return this.blameData;
        }

        const start = this.dateRange.startDate || new Date(0);
        const end = this.dateRange.endDate || new Date();

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
                const tooltip = `${info.author} • ${formatDate(info.date)}\nLines: ${info.lines.join(', ')}`;
                
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
                    `Date: ${formatDate(commitInfo.date)}`,
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

    getCurrentDateFilter(): string {
        return this.currentDateFilter;
    }
    
    getStartDate(): Date | undefined {
        return this.dateRange.startDate;
    }

    getEndDate(): Date | undefined {
        return this.dateRange.endDate;
    }
}
