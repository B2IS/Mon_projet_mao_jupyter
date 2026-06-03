import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * AbacGuard — porte d'entrée ABAC. Après authentification Keycloak (OIDC/SSO/MFA,
 * via nest-keycloak-connect), le sujet JWT est résolu en `app_user` ; on attache
 * `req.userId` pour que les services appliquent OrgScopeService.pathFilter().
 *
 * Fonctionne pour REST **et** GraphQL (même contexte de requête).
 * La sécurité de DONNÉES est doublée au niveau base (PostgreSQL Row-Level Security,
 * cf. 01_data_model.sql) : défense en profondeur.
 */
@Injectable()
export class AbacGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = this.getRequest(ctx);
    if (!req) return false;
    // En prod : req.user provient du token Keycloak validé.
    const sub = req.user?.sub ?? req.headers?.['x-user-id'];
    if (!sub) return false;
    // Résolution sub → app_user (mappée en amont par un interceptor / cache Redis).
    req.userId = req.user?.appUserId ?? sub;
    return true;
  }

  /** Récupère la requête pour REST ou GraphQL. */
  private getRequest(ctx: ExecutionContext): any {
    if (ctx.getType<string>() === 'graphql') {
      return GqlExecutionContext.create(ctx).getContext().req;
    }
    return ctx.switchToHttp().getRequest();
  }
}
