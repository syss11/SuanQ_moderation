import fs from 'fs'
import path from "path";

interface SensitiveWord {
    word: string;
    severity: number;
}

export class SqFilter{
    private all: SensitiveWord[] = []
    private wordSet: Set<string>
    private path: string

    constructor(path: string){
        this.path = path
        this.wordSet = new Set()
        this.ensureFileExists()
        this.init()
    }
    private ensureFileExists(): void {
        if (!fs.existsSync(this.path)) {
            const dir = path.dirname(this.path);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.path, JSON.stringify([], null, 2));
        }
    }
    public init(): void{
        const data = fs.readFileSync(this.path, 'utf8');
        const json = JSON.parse(data);
        if (Array.isArray(json)) {
            this.all = json.map((item: any) => {
                if (typeof item === 'string') {
                    return { word: item, severity:1 };
                }
                return { word: item.word || '', severity: item.severity ||1 };
            }).filter((item: SensitiveWord) => item.word);
        }
        this.rebuildWordSet();
    }
    public add(word: string, severity: number = 1){
        this.all.push({ word, severity });
        this.rebuildWordSet();
    }
    public remove(word: string){
        const index = this.all.findIndex(item => item.word === word);
        if (index !== -1) {
            this.all.splice(index, 1);
            this.rebuildWordSet();
        }
    }
    private rebuildWordSet(): void {
        this.wordSet = new Set(this.all.map(item => item.word));
    }
    private normalizeText(text: string): string {
        return text
            .replace(/\s+/g, '')
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .toLowerCase();
    }
    public save(){
        fs.writeFileSync(this.path, JSON.stringify(this.all, null, 2));
    }
    public filter(text: string){
        const normalizedText = this.normalizeText(text);
        for (const word of this.all) {
            if (normalizedText.includes(word.word.toLowerCase())) {
                return word.word;
            }
        }
        return text;
    }
    public verify(text: string): { matched: boolean; severity: number }{
        const normalizedText = this.normalizeText(text);
        for (const item of this.all) {
            if (normalizedText.includes(item.word.toLowerCase())) {
                return {
                    matched: true,
                    severity: item.severity
                };
            }
        }
        
        return {
            matched: false,
            severity: 0
        };
    }
}

const sensitivePath = path.join(process.cwd(), "data", "sensitive.json");
export const sensitiveFilter = new SqFilter(sensitivePath);