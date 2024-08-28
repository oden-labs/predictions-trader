import dotenv from 'dotenv';
import path from 'path';

export class ConfigService {
    constructor() {
        dotenv.config({ path: path.resolve(__dirname, '../../.env') });
    }

    get(key: string): string {
        const value = process.env[key];
        if (!value) {
            throw new Error(`Configuration key ${key} not found`);
        }
        return value;
    }
}
