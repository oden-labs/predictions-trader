import chalk from 'chalk';

export class Logger {
    constructor(private context: string) { }

    info(message: string): void {
        console.log(chalk.blue(`[${this.context}] INFO: ${message}`));
    }

    warn(message: string): void {
        console.log(chalk.yellow(`[${this.context}] WARN: ${message}`));
    }

    error(message: string, error?: Error): void {
        console.error(chalk.red(`[${this.context}] ERROR: ${message}`), error);
    }
}
