import * as vscode from 'vscode';

export class BlameTreeItem extends vscode.TreeItem {
    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly commit?: string,
        public readonly email?: string,
        public readonly date?: Date,
        public readonly commandId?: string,
        tooltip?: string,
        public readonly lines?: string[],
        public readonly isHeader: boolean = false,
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

    static createSimple(label: string, collapsibleState: vscode.TreeItemCollapsibleState): BlameTreeItem {
        return new BlameTreeItem(label, collapsibleState);
    }

    static builder(label: string, collapsibleState: vscode.TreeItemCollapsibleState): BlameTreeItemBuilder {
        return new BlameTreeItemBuilder(label, collapsibleState);
    }
}

/**
 * Builder class for creating BlameTreeItem instances with a fluent API
 */
export class BlameTreeItemBuilder {
    private _commit?: string;
    private _email?: string;
    private _date?: Date;
    private _commandId?: string;
    private _tooltip?: string;
    private _lines?: string[];
    private _isHeader: boolean = false;
    private _filepath?: string;
    private _iconPath?: vscode.ThemeIcon;
    private _description?: string;

    constructor(
        private _label: string,
        private _collapsibleState: vscode.TreeItemCollapsibleState
    ) {}

    withCommit(commit: string): this {
        this._commit = commit;
        return this;
    }

    withEmail(email: string): this {
        this._email = email;
        return this;
    }

    withDate(date: Date): this {
        this._date = date;
        return this;
    }

    withCommandId(commandId: string): this {
        this._commandId = commandId;
        return this;
    }

    withTooltip(tooltip: string): this {
        this._tooltip = tooltip;
        return this;
    }

    withLines(lines: string[]): this {
        this._lines = lines;
        return this;
    }

    withIsHeader(isHeader: boolean): this {
        this._isHeader = isHeader;
        return this;
    }

    withFilepath(filepath: string): this {
        this._filepath = filepath;
        return this;
    }

    withIcon(icon: vscode.ThemeIcon): this {
        this._iconPath = icon;
        return this;
    }

    withDescription(description: string): this {
        this._description = description;
        return this;
    }

    build(): BlameTreeItem {
        const item = new BlameTreeItem(
            this._label,
            this._collapsibleState,
            this._commit,
            this._email,
            this._date,
            this._commandId,
            this._tooltip,
            this._lines,
            this._isHeader,
            this._filepath
        );

        if (this._iconPath) {
            item.iconPath = this._iconPath;
        }

        if (this._description !== undefined) {
            item.description = this._description;
        }

        return item;
    }
}
