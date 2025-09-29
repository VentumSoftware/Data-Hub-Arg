// src/access/guards/token-auth.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core'; // ← Necesitas esto para el decorador
import { REQUIRES_AUTH_TOKEN } from '../decorators/auth-token.decorator';

@Injectable() // ← No olvides este decorador
export class TokenAuthGuard implements CanActivate {
  private readonly validToken = process.env.AUTH_TOKEN;

  constructor(private reflector: Reflector) {} // ← Inyectar Reflector

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    
    // ✅ Verificar si el endpoint requiere el token específico
    const requiresAuthToken = this.reflector.get<boolean>(
      REQUIRES_AUTH_TOKEN, 
      context.getHandler()
    );

    // Si el endpoint NO requiere token específico, pasar directamente
    if (!requiresAuthToken) {
      return true;
    }

    // Si el endpoint SÍ requiere token específico, validarlo
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
      throw new UnauthorizedException({
        success: false,
        message: 'Auth token required for this endpoint',
        error: 'MISSING_AUTH_TOKEN'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    if (token === this.validToken) {
      // ✅ Token válido - setear flags para que AuthGuard lo detecte
      req['bypassedByToken'] = true;
      req['isAuthenticated'] = true;
      req['user'] = { 
        id: 0, 
        name: 'System',
        email: 'system@token',
        isSystem: true 
      };
      return true;
    }
    
    // ❌ Token inválido
    throw new UnauthorizedException({
      success: false,
      message: 'Invalid auth token',
      error: 'INVALID_AUTH_TOKEN'
    });
  }
}