import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { GraphqlCoreModule } from './graphql/graphql-core.module';
import { PrismaModule } from './common/prisma.module';
// Phase 1 — Socle
import { OrganisationModule } from './modules/organisation/organisation.module';
import { ProjetModule } from './modules/projet/projet.module';
// Phase 2 — Cœur projet
import { ProgrammeModule } from './modules/programme/programme.module';
import { PlanningModule } from './modules/planning/planning.module';
import { MarcheModule } from './modules/marche/marche.module';
import { AttachementModule } from './modules/attachement/attachement.module';
// Phase 3 — Finances & patrimoine
import { FinanceModule } from './modules/finance/finance.module';
import { ImmobilisationModule } from './modules/immobilisation/immobilisation.module';
// Phase 4 — Transverses
import { UaglModule } from './modules/uagl/uagl.module';
import { GedModule } from './modules/ged/ged.module';
import { GisModule } from './modules/gis/gis.module';
// Phase 5 — Pilotage
import { KpiModule } from './modules/kpi/kpi.module';
import { RisqueModule } from './modules/risque/risque.module';
// Phase 6 — Workflow (Camunda 8)
import { WorkflowModule } from './modules/workflow/workflow.module';
// Phase 7 — AI Center
import { AiModule } from './modules/ai/ai.module';
// Modules transverses 15 & 18 — Low-Code Studio & Administration
import { LowcodeModule } from './modules/lowcode/lowcode.module';
import { AdminModule } from './modules/admin/admin.module';

/**
 * AppModule — SIGEPP-DPE Backend Enterprise (NestJS / DDD / CQRS / Event-Driven).
 * Plateforme ORGANIZATION-DRIVEN : l'organisation est le référentiel maître ;
 * tout objet métier (projet, marché, budget, KPI, risque, immo, doc, mission,
 * workflow, agent IA) hérite automatiquement de sa sécurité via `orgPath`.
 *
 *  Phase 1  Socle       — Organisation + RH + Sécurité ABAC + Projet
 *  Phase 2  Cœur projet — Programmes · Planning/EVM · Marchés · Attachements BOQ (CQRS)
 *  Phase 3  Finances    — Budget/CBS · Décaissements · Cashflow · Immobilisations (amort.)
 *  Phase 4  Transverses — UAGL (ODM/flotte/pointage/salles) · GED (MinIO) · GIS (ArcGIS)
 *  Phase 5  Pilotage    — KPI sécurisés (consolidé = DPE/CSE) · Risques · S&E
 *  Phase 6  Workflow    — Camunda 8 (défs versionnées, instances org-scoped)
 *  Phase 7  AI Center   — Agents org-secured · Migration IA (HITL)
 *  Phase 8  Frontend    — branchement de l'app Next.js, écran par écran
 */
@Module({
  imports: [
    CqrsModule,
    PrismaModule, // une seule instance Prisma, partagée (global)
    // GraphQL BFF org-aware (code-first) — livrable 7
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/graphql/schema.gql'),
      context: ({ req }: any) => ({ req }),
      sortSchema: true,
    }),
    GraphqlCoreModule,
    // Phase 1
    OrganisationModule,
    ProjetModule,
    // Phase 2
    ProgrammeModule,
    PlanningModule,
    MarcheModule,
    AttachementModule,
    // Phase 3
    FinanceModule,
    ImmobilisationModule,
    // Phase 4
    UaglModule,
    GedModule,
    GisModule,
    // Phase 5
    KpiModule,
    RisqueModule,
    // Phase 6
    WorkflowModule,
    // Phase 7
    AiModule,
    // Modules 15 & 18
    LowcodeModule,
    AdminModule,
  ],
})
export class AppModule {}
