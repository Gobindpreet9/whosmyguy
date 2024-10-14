export interface BlameInfo {
    lines: string[];   
    commit: string; 
    author: string;
    authorEmail: string;
    date: Date;
    message: string;
}