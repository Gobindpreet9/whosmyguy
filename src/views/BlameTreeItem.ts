import * as vscode from 'vscode';

export class BlameTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly commit?: string,
        public readonly email?: string,
        public readonly date?: Date,
        public readonly commandId?: string,
        public readonly tooltip?: string,
        public readonly lines?: string[],
        public readonly isHeader?: boolean,
        public readonly filepath?: string
    ) {
        super(label, collapsibleState);
        
        this.iconPath = this.getIconForType();
        this.contextValue = this.getContextValue();
        
        if (tooltip) {
            this.tooltip = tooltip;
        }
        
        if (this.commandId && this.commit) {
            this.command = {
                command: this.commandId,
                title: '',
                arguments: [this.commit, this.filepath]
            };
        } else if (this.commandId && this.email) {
            this.command = {
                command: this.commandId,
                title: '',
                arguments: [this.email]
            };
        }
    }

    private getIconForType(): any {
        if (this.commandId === 'whosmyguy.openCommit') {
            return new vscode.ThemeIcon('git-commit');
        }
        
        if (this.commandId === 'whosmyguy.openEmail') {
            return new vscode.ThemeIcon('mail');
        }
        
        if (this.date) {
            return new vscode.ThemeIcon('calendar');
        }
        
        if (this.lines) {
            return new vscode.ThemeIcon('list-ordered');
        }

        return undefined;
    }

    private getContextValue(): string {
        if (this.commit) { return 'commit'; }
        if (this.email) { return 'email'; }
        if (this.date) { return 'date'; }
        if (this.lines) { return 'lines'; }
        if (this.isHeader) { return 'header'; }
        return '';
    }
}
