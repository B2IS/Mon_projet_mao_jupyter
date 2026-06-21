/**
 * GET /api/openapi — Spécification OpenAPI 3.0 de SIGEP-DPE
 * Sert le JSON utilisé par Swagger UI sur /docs
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'SIGEP-DPE — API REST',
    description:
      'Système Intégré de Gestion, Évaluation et Pilotage de Projets — Direction Principale Équipement SENELEC.\n\n' +
      '**Architecture souveraine** : déployable on-premise, aucune dépendance cloud obligatoire.\n\n' +
      '**IA locale** : le moteur IA utilise Ollama (modèles open-source) en priorité.\n\n' +
      '**Authentification** : Bearer token JWT (header `Authorization: Bearer <token>`).',
    version: '2.0.0',
    contact: {
      name: 'Direction Principale Équipement — SENELEC',
      email: 'dpe@senelec.sn',
    },
    license: { name: 'Propriétaire — SENELEC DPE', url: 'https://senelec.sn' },
  },
  servers: [
    { url: '/api', description: 'Serveur courant (Next.js)' },
    { url: 'http://localhost:3000/api', description: 'Développement local' },
    { url: 'http://localhost:4000/api', description: 'NestJS backend (si déployé)' },
  ],
  tags: [
    { name: 'IA', description: 'Moteurs IA — Copilot, Swarm multi-agents, migration documentaire' },
    { name: 'Projets', description: 'Gestion du portefeuille de projets DPE' },
    { name: 'Intégrations', description: 'Connecteurs ArcGIS, Oracle Unifier, systèmes tiers' },
    { name: 'Infrastructure', description: 'Santé du système, configuration, version' },
  ],
  paths: {

    /* ── IA ─────────────────────────────────────────────────── */

    '/ai/copilot': {
      post: {
        tags: ['IA'],
        summary: 'Chat avec le Copilot IA (Azure OpenAI / OpenAI-compatible)',
        description:
          'Proxy serveur vers Azure OpenAI ou tout endpoint OpenAI-compatible. ' +
          'Les variables d\'environnement serveur (AZURE_OPENAI_*) ont priorité sur la configuration client.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['messages'],
                properties: {
                  messages: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        role: { type: 'string', enum: ['system', 'user', 'assistant'] },
                        content: { type: 'string' },
                      },
                    },
                    description: 'Historique de conversation',
                  },
                  endpoint: { type: 'string', description: 'URL Azure OpenAI (si non configuré via env)' },
                  deployment: { type: 'string', description: 'Nom du déploiement (ex: gpt-4o)', default: 'gpt-4o' },
                  apiKey: { type: 'string', description: 'Clé API (si non configurée via env)' },
                  apiVersion: { type: 'string', description: 'Version API Azure', default: '2024-08-01-preview' },
                  temperature: { type: 'number', minimum: 0, maximum: 2, default: 0.5 },
                  maxTokens: { type: 'integer', minimum: 1, maximum: 8192, default: 2048 },
                },
              },
              example: {
                messages: [
                  { role: 'system', content: 'Tu es un expert SENELEC DPE.' },
                  { role: 'user', content: 'Quel est le taux de réalisation du programme BEST ?' },
                ],
                temperature: 0.5,
                maxTokens: 1024,
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Réponse du modèle',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    content: { type: 'string', description: 'Texte de réponse' },
                    model: { type: 'string', description: 'Modèle utilisé' },
                    usage: {
                      type: 'object',
                      properties: {
                        prompt_tokens: { type: 'integer' },
                        completion_tokens: { type: 'integer' },
                        total_tokens: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Requête invalide (JSON malformé ou messages manquants)' },
          422: { description: 'Configuration Copilot incomplète (endpoint/clé manquant)' },
          502: { description: 'Erreur retournée par le service Azure/OpenAI' },
          504: { description: 'Délai dépassé (timeout 45s)' },
        },
      },
    },

    '/swarm': {
      post: {
        tags: ['IA'],
        summary: 'Pipeline swarm multi-agents (SSE streaming)',
        description:
          'Déclenche le pipeline d\'analyse IA à 7 agents (planificateur, financier, risques, ressources, suivi-éval, GED, chef de projet). ' +
          'Répond en **Server-Sent Events** (`text/event-stream`). ' +
          'Chaque événement est `data: <JSON>\\n\\n`. ' +
          'Le moteur IA utilise **Ollama** (local souverain) en priorité, puis Groq en fallback.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['files'],
                properties: {
                  files: {
                    type: 'array',
                    description: 'Fichiers à analyser (texte extrait)',
                    items: {
                      type: 'object',
                      required: ['name', 'content'],
                      properties: {
                        name: { type: 'string', description: 'Nom du fichier (ex: rapport-avancement.pdf)' },
                        content: { type: 'string', description: 'Contenu texte extrait du fichier' },
                        mimeType: { type: 'string', description: 'Type MIME original' },
                      },
                    },
                  },
                  projectOverrides: {
                    type: 'object',
                    description: 'Valeurs de projet à forcer (domaine, chef, etc.)',
                    additionalProperties: true,
                  },
                },
              },
              example: {
                files: [{ name: 'ODM-2026.pdf', content: 'Ordre de Mission numéro 2026-045...', mimeType: 'application/pdf' }],
                projectOverrides: { domaine: 'distribution' },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Stream SSE — événements émis pendant le traitement',
            content: {
              'text/event-stream': {
                schema: {
                  type: 'string',
                  description:
                    'Séquence d\'événements SSE. Types d\'événements :\n' +
                    '- `agent_start` : début d\'un agent\n' +
                    '- `agent_done` : fin d\'un agent avec résultat\n' +
                    '- `agent_error` : erreur d\'un agent\n' +
                    '- `swarm_done` : pipeline terminé — contient le contexte projet complet\n' +
                    '- `pipeline_error` : erreur fatale',
                },
              },
            },
          },
          400: { description: 'Fichiers manquants ou JSON invalide' },
        },
      },
    },

    /* ── Intégrations ──────────────────────────────────────── */

    '/integrations/arcgis': {
      post: {
        tags: ['Intégrations'],
        summary: 'Proxy ArcGIS — Recherche de features géographiques',
        description:
          'Proxy serveur vers ArcGIS Online / ArcGIS Enterprise. ' +
          'Permet d\'éviter les problèmes CORS depuis le navigateur. ' +
          'Supporte les FeatureServer queryFeatures.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['serviceUrl', 'layerIndex'],
                properties: {
                  serviceUrl: { type: 'string', description: 'URL du FeatureServer ArcGIS' },
                  layerIndex: { type: 'integer', default: 0 },
                  where: { type: 'string', default: '1=1', description: 'Clause WHERE SQL' },
                  outFields: { type: 'string', default: '*' },
                  resultRecordCount: { type: 'integer', default: 100 },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Features GeoJSON retournées par ArcGIS' },
          400: { description: 'Paramètres invalides' },
          502: { description: 'Erreur ArcGIS' },
        },
      },
    },

    '/integrations/oracle': {
      post: {
        tags: ['Intégrations'],
        summary: 'Proxy Oracle Unifier — Lecture de données projet',
        description:
          'Proxy serveur vers Oracle Primavera Unifier. ' +
          'Permet la synchronisation bidirectionnelle des projets SENELEC depuis Unifier.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['action'],
                properties: {
                  action: {
                    type: 'string',
                    enum: ['getProjects', 'getProject', 'updateProject', 'getWBS'],
                    description: 'Action Unifier à exécuter',
                  },
                  projectId: { type: 'string', description: 'ID du projet Unifier (si action ciblée)' },
                  payload: { type: 'object', description: 'Données additionnelles selon l\'action' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Données Oracle Unifier' },
          400: { description: 'Action invalide' },
          502: { description: 'Erreur Oracle Unifier' },
        },
      },
    },

    /* ── Infrastructure ────────────────────────────────────── */

    '/openapi': {
      get: {
        tags: ['Infrastructure'],
        summary: 'Spécification OpenAPI 3.0 (ce document)',
        description: 'Retourne la spécification OpenAPI 3.0 de l\'API SIGEP-DPE en JSON.',
        responses: {
          200: {
            description: 'Spécification OpenAPI 3.0',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token JWT obtenu via /api/auth/login',
      },
    },
    schemas: {
      ChatMessage: {
        type: 'object',
        required: ['role', 'content'],
        properties: {
          role: { type: 'string', enum: ['system', 'user', 'assistant'] },
          content: { type: 'string' },
        },
      },
      SSEEvent: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['agent_start', 'agent_done', 'agent_error', 'swarm_done', 'pipeline_error'],
          },
          agentId: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
          result: { type: 'object', additionalProperties: true },
          error: { type: 'string' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string', description: 'Message d\'erreur lisible' },
          detail: { type: 'string', description: 'Détail technique (optionnel)' },
        },
      },
    },
  },
};

export async function GET(req: NextRequest) {
  const guard = await requireApiAuth(req);
  if (!guard.ok) return guard.response;

  return NextResponse.json(spec, {
    headers: {
      'Cache-Control': 'private, no-store',
      'Access-Control-Allow-Origin': process.env.NODE_ENV === 'production'
        ? (process.env.NEXTAUTH_URL ?? 'https://sigep-dpe.vercel.app')
        : 'http://localhost:3000',
    },
  });
}
