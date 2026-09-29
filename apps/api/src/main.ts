import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureHttpApp } from './bootstrap/configure-http-app.js';
import { AppConfig } from './config/app-config.js';

const app = await NestFactory.create(AppModule, { bufferLogs: true });
configureHttpApp(app);
await app.listen(app.get(AppConfig).http.port);
