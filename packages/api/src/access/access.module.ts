import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AccessService } from './access.service';
import { AccessController } from './access.controller';
import { GoogleStrategy } from './strategies/google.strategy';
import { AuthGuard } from './guards/auth.guard';
import { PermissionGuard } from './guards/permission.guard';
import { PermissionsService } from './services/permissions.service';
import { ScopeConfigService } from './services/scope-config.service';
import { IpApiService } from './services/ip-api.service';

@Module({
  imports: [
    DatabaseModule,
  ],
  controllers: [AccessController],
  providers: [
    AccessService, 
    GoogleStrategy, 
    AuthGuard, 
    PermissionGuard,
    PermissionsService,
    ScopeConfigService,
    IpApiService
  ],
  exports: [
    AccessService, 
    AuthGuard, 
    PermissionGuard,
    PermissionsService,
    ScopeConfigService
  ],
})

export class AccessModule {
  // No longer using middleware - authentication is now handled by AuthGuard only
}
