import * as vscode from 'vscode';
import { BlameInfo } from '../git/BlameInfo';
import { GitManager } from '../git/gitManager';
import { BlameTreeDataProvider } from './blameTreeDataProvider';
import { BlameTreeItem } from './BlameTreeItem';

export class BlameView {
    private treeDataProvider: BlameTreeDataProvider;
    private treeView: vscode.TreeView<BlameTreeItem>;
    private dateFilterPicker: vscode.QuickPick<vscode.QuickPickItem>;
    private currentFilepath: string = '';
    private gitManager: GitManager | undefined;
    
    constructor(private context: vscode.ExtensionContext) {
        this.treeDataProvider = new BlameTreeDataProvider();
        this.treeView = vscode.window.createTreeView('whosmyguyView', {
            treeDataProvider: this.treeDataProvider,
            showCollapseAll: true,
            canSelectMany: false
        });
        
        this.dateFilterPicker = vscode.window.createQuickPick();
        this.dateFilterPicker.placeholder = 'Select date filter';
        this.resetDateFilterPickerItems();
        
        this.dateFilterPicker.onDidChangeSelection(items => {
            if (items.length === 0) { return; }
            
            const selectedItem = items[0].label;
            if (selectedItem.includes('Last 6 months')) {
                this.treeDataProvider.setDateFilter('last6Months');
            } else if (selectedItem.includes('Today')) {
                this.treeDataProvider.setDateFilter('today');
            } else if (selectedItem.includes('This week')) {
                this.treeDataProvider.setDateFilter('thisWeek');
            } else if (selectedItem.includes('This month')) {
                this.treeDataProvider.setDateFilter('thisMonth');
            } else if (selectedItem.includes('All time')) {
                this.treeDataProvider.setDateFilter('allTime');
            } else if (selectedItem.includes('Custom range')) {
                this.showCustomDateRangePicker();
            }
            
            this.dateFilterPicker.hide();
        });
        
        this.registerCommands();
        
        context.subscriptions.push(
            this.treeView,
            this.dateFilterPicker
        );
    }
    
    private registerCommands(): void {
        this.context.subscriptions.push(
            vscode.commands.registerCommand('whosmyguy.openCommit', (commit: string) => {
                if (this.gitManager && this.currentFilepath) {
                    this.gitManager.openCommitInGitExtension(commit, this.currentFilepath);
                }
            }),
            vscode.commands.registerCommand('whosmyguy.openEmail', (email: string) => {
                vscode.env.openExternal(vscode.Uri.parse(`mailto:${email}`));
            }),
            vscode.commands.registerCommand('whosmyguy.changeFilter', () => {
                this.resetDateFilterPickerItems();
                this.dateFilterPicker.show();
            }),
            vscode.commands.registerCommand('whosmyguy.refreshBlameInfo', () => {
                vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
                vscode.commands.executeCommand('whosmyguy.findGuy');
            }),
            vscode.commands.registerCommand('whosmyguy.clearFilter', () => {
                this.treeDataProvider.setDateFilter('allTime');
            })
        );
    }
    
    private async showCustomDateRangePicker(): Promise<void> {
        const startDateString = await vscode.window.showInputBox({
            prompt: '(Step 1 of 2): Enter START date (YYYY-MM-DD)',
            placeHolder: 'e.g. 2023-01-01',
            validateInput: this.validateDateFormat
        });
        
        if (startDateString === undefined) { return; }
        
        let endDateString = await vscode.window.showInputBox({
            prompt: '(Step 2 of 2): Enter END date (YYYY-MM-DD). Default is today.',
            placeHolder: 'e.g. 2023-12-31',
            validateInput: this.validateDateFormat
        });
        
        if (endDateString === undefined) { endDateString = new Date().toISOString().split('T')[0]; }
        
        this.treeDataProvider.setCustomDateRange(startDateString, endDateString);
    }
    
    private validateDateFormat(value: string): string | undefined {
        if (!value) { return undefined; }
        
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(value)) {
            return 'Please enter date in YYYY-MM-DD format';
        }
        
        const date = new Date(value);
        if (isNaN(date.getTime())) {
            return 'Invalid date';
        }
        
        return undefined;
    }
    

    public show(gitManager: GitManager, blameInfo: BlameInfo[], filepath: string): void {
        this.gitManager = gitManager;
        this.currentFilepath = filepath;
        vscode.commands.executeCommand('whosmyguyView.focus');
        this.treeDataProvider.refresh(blameInfo, undefined, undefined, filepath);
    }

    private resetDateFilterPickerItems() {
        this.dateFilterPicker.items = [
            { label: '$(history) Last 6 months', description: 'Show commits from the last 6 months', detail: 'Default filter' },
            { label: '$(calendar) Today', description: 'Show commits from today' },
            { label: '$(calendar) This week', description: 'Show commits from this week' },
            { label: '$(calendar) This month', description: 'Show commits from this month' },
            { label: '$(repo-sync) All time', description: 'Show all commits' },
            { label: '$(calendar) Custom range...', description: 'Specify a custom date range' }
        ];
    }
}
