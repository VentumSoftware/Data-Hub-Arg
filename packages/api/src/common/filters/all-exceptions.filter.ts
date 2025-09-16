// common/filters/all-exceptions.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    // Log complete error details
    console.error('=== EXCEPTION CAUGHT ===');
    console.error('URL:', request.url);
    console.error('Method:', request.method);
    console.error('Status:', status);
    console.error('Error:', exception);
    if (exception instanceof Error) {
      console.error('Stack:', exception.stack);
    }
    console.error('======================');

    const message = exception instanceof HttpException ? exception.getResponse() : (exception as any).message || 'Internal server error';
    response.status(status).json({ message });
  }
}
