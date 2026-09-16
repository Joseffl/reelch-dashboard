import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok' as const,
      service: 'reelch-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    };
  }
}
