import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseService } from './database/database.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: DatabaseService, useValue: { ping: vi.fn().mockResolvedValue(true) } }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('reports the API as healthy', () => {
      expect(appController.getHealth()).toMatchObject({
        status: 'ok',
        service: 'reelch-api',
        version: '0.1.0',
      });
    });
  });

  describe('readiness', () => {
    it('reports a connected database', async () => {
      await expect(appController.getReadiness()).resolves.toMatchObject({ status: 'ready', database: 'connected' });
    });
  });
});
