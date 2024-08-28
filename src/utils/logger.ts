export class Logger {
    constructor(private context: string) { }

    info(message: string): void {
        console.log(`[${this.context}] INFO: ${message}`);
    }

    error(message: string, error?: Error): void {
        console.error(`[${this.context}] ERROR: ${message}`, error);
    }
}
