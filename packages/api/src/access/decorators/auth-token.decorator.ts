// src/access/decorators/auth-token.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const REQUIRES_AUTH_TOKEN = 'requiresAuthToken';

export function AuthToken() {
  return SetMetadata(REQUIRES_AUTH_TOKEN, true);
}