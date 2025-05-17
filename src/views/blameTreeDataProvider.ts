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
                    BlameTreeItem.builder('Welcome', vscode.TreeItemCollapsibleState.None)
                        .withTooltip('View and analyze git history for your selected code')
                        .withIsHeader(true)
                        .build(),
                    BlameTreeItem.createSimple('1. Select code in the editor', vscode.TreeItemCollapsibleState.None),
                    BlameTreeItem.createSimple('2. Right-click and select "Who\'s My Guy?"', vscode.TreeItemCollapsibleState.None),
                    BlameTreeItem.createSimple('3. View commit history (last 6 months by default)', vscode.TreeItemCollapsibleState.None),
                    BlameTreeItem.createSimple('4. Use the filter button to change date range', vscode.TreeItemCollapsibleState.None)
                ]);
            }
            
            const filteredData = this.getFilteredData();
            if (filteredData.length === 0) {
                return Promise.resolve([
                    BlameTreeItem.builder('No commits found in the selected date range', vscode.TreeItemCollapsibleState.None)
                        .withTooltip('Try selecting a different date range or clear the filter to see all commits')
                        .build()
                ]);
            }

            return Promise.resolve(filteredData.map(info => {
                const lineInfo = info.lines.length > 0 ? `[Lines: ${info.lines.join(', ')}]` : '';
                const label = `${info.commit.substring(0, 7)} - ${lineInfo} ${info.message.split('\n')[0]}`;
                const tooltip = `${info.author} • ${formatDate(info.date)}\nLines: ${info.lines.join(', ')}`;
                
                const item = BlameTreeItem.builder(label, vscode.TreeItemCollapsibleState.Collapsed)
                    .withCommit(info.commit)
                    .withDate(info.date)
                    .withTooltip(tooltip || '')
                    .withLines(info.lines)
                    .withFilepath(this.filepath || '')
                    .withIcon(new vscode.ThemeIcon('git-commit'))
                    .build();
                return item;
            }));
        } else if (element.commit) {
            const commitInfo = this.blameData.find(info => info.commit === element.commit);
            if (!commitInfo) { return Promise.resolve([]); }
            
            const authorItem = BlameTreeItem.builder(`Author: ${commitInfo.author}`, vscode.TreeItemCollapsibleState.None)
                .withEmail(commitInfo.authorEmail)
                .withCommandId('whosmyguy.openEmail')
                .withTooltip(`Click to email: ${commitInfo.authorEmail}`)
                .withFilepath(this.filepath || '')
                .build();

            const commitItem = BlameTreeItem.builder(`Commit: ${commitInfo.commit.substring(0, 7)}`, vscode.TreeItemCollapsibleState.None)
                .withCommit(commitInfo.commit)
                .withCommandId('whosmyguy.openCommit')
                .withTooltip('Click to open commit details')
                .withFilepath(this.filepath || '')
                .withIcon(new vscode.ThemeIcon('go-to-file'))
                .withDescription('View')
                .build();

            const dateItem = BlameTreeItem.builder(
                `Date: ${formatDate(commitInfo.date)}`,
                vscode.TreeItemCollapsibleState.None
            )
            .withDate(commitInfo.date)
            .build();
            
            const linesItem = BlameTreeItem.builder(
                `Lines: ${commitInfo.lines.join(', ')}`,
                vscode.TreeItemCollapsibleState.None
            )
            .withLines(commitInfo.lines)
            .build();

            return Promise.resolve([authorItem, commitItem, dateItem, linesItem]);
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
