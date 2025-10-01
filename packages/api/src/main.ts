import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import * as cookieParser from 'cookie-parser';
import * as passport from 'passport';
import { config } from 'dotenv';

config({ override: true });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Trust proxy to get real IP addresses when behind nginx/load balancer
  app.getHttpAdapter().getInstance().set('trust proxy', true);

  // Global exception filter for consistent error responses
  app.useGlobalFilters(new AllExceptionsFilter());

  // Error handlers for unhandled promises and exceptions
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
  });

  // CORS configuration
  const allowedOrigins = [process.env.FE_URL];
  const corsOrigin = process.env.CORS_ORIGIN;
  if (corsOrigin) {
    allowedOrigins.push(...corsOrigin.split(','));
  }

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., mobile apps, Postman)
      if (!origin) {
        callback(null, true);
        return;
      }

      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else if (process.env.NODE_ENV === 'development') {
        // In development, allow all origins
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  // Middleware setup
  app.use(cookieParser(process.env.COOKIE_SECRET || 'supersecret'));
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));

  // API prefix for all routes
  app.setGlobalPrefix('api');

  // Swagger API documentation
  const config = new DocumentBuilder()
    .setTitle(`${process.env.APP_NAME || 'App'} API`)
    .setDescription(`API documentation for ${process.env.APP_NAME || 'the application'}`)
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: true
  });

  // Initialize passport for OAuth strategies
  app.use(passport.initialize());

  // Start server
  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 Application is running on: http://localhost:${port}/api`);
  console.log(`📚 API documentation available at: http://localhost:${port}/api/docs`);
  // console.log(`📝 Environment variables for PSQ: `, {
  //   POSTGRES_DB: process.env.POSTGRES_DB,
  //   POSTGRES_USER: process.env.POSTGRES_USER,
  //   POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
  //   POSTGRES_PORT: process.env.POSTGRES_PORT,
  //   POSTGRES_HOST: process.env.POSTGRES_HOST,
  //   DATABASE_URL: process.env.DATABASE_URL
  // });
}
bootstrap();
