/**
 * integrationConfigStore.ts — Configuration dynamique des intégrations externes
 * Persisté dans localStorage pour éviter les recompilations
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ArcGISStoredConfig {
  portalUrl: string;
  username: string;
  password: string;
  clientId: string;
  clientSecret: string;
  featureServerUrl: string;
  geometryServerUrl: string;
}

/**
 * Microsoft Copilot (Microsoft 365 / Azure OpenAI) — intégration IA d'entreprise.
 * Authentification via le compte Microsoft (Entra ID / Azure AD) de SENELEC.
 */
export interface CopilotStoredConfig {
  enabled: boolean;
  tenantId: string;       // ID de locataire Microsoft Entra (Azure AD)
  clientId: string;       // ID d'application (App registration)
  account: string;        // Compte Microsoft 365 utilisé (UPN / email)
  endpoint: string;       // Endpoint Azure OpenAI / Copilot
  deployment: string;     // Nom du déploiement de modèle (ex. gpt-4o)
  apiKey: string;         // Clé API (optionnelle si SSO Entra)
}

export interface IntegrationConfigState {
  arcgis: ArcGISStoredConfig;
  updateArcGIS: (cfg: Partial<ArcGISStoredConfig>) => void;
  resetArcGIS: () => void;
  copilot: CopilotStoredConfig;
  updateCopilot: (cfg: Partial<CopilotStoredConfig>) => void;
  resetCopilot: () => void;
}

const DEFAULT_ARCGIS: ArcGISStoredConfig = {
  portalUrl: 'https://senelec.maps.arcgis.com',
  username: 'dpe_sig_admin',
  password: '',
  clientId: '',
  clientSecret: '',
  featureServerUrl: 'https://services.senelec.sn/arcgis/rest/services/DPE/Patrimoine_Reseau/FeatureServer',
  geometryServerUrl: 'https://services.senelec.sn/arcgis/rest/services/Utilities/Geometry/GeometryServer',
};

const DEFAULT_COPILOT: CopilotStoredConfig = {
  enabled: false,
  tenantId: '',
  clientId: '',
  account: '',
  endpoint: 'https://senelec.openai.azure.com',
  deployment: 'gpt-4o',
  apiKey: '',
};

export const useIntegrationConfig = create<IntegrationConfigState>()(
  persist(
    (set) => ({
      arcgis: { ...DEFAULT_ARCGIS },
      updateArcGIS: (cfg) => set(state => ({
        arcgis: { ...state.arcgis, ...cfg },
      })),
      resetArcGIS: () => set({ arcgis: { ...DEFAULT_ARCGIS } }),
      copilot: { ...DEFAULT_COPILOT },
      updateCopilot: (cfg) => set(state => ({
        copilot: { ...state.copilot, ...cfg },
      })),
      resetCopilot: () => set({ copilot: { ...DEFAULT_COPILOT } }),
    }),
    {
      name: 'sigepp-integration-config',
      partialize: (state) => ({ arcgis: state.arcgis, copilot: state.copilot }),
    }
  )
);

export function getCopilotConfig(): CopilotStoredConfig {
  const state = useIntegrationConfig.getState();
  return {
    enabled:    state.copilot.enabled,
    tenantId:   process.env.MS_TENANT_ID   || state.copilot.tenantId,
    clientId:   process.env.MS_CLIENT_ID   || state.copilot.clientId,
    account:    state.copilot.account,
    endpoint:   process.env.AZURE_OPENAI_ENDPOINT   || state.copilot.endpoint,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT || state.copilot.deployment,
    apiKey:     process.env.AZURE_OPENAI_KEY        || state.copilot.apiKey,
  };
}

export function getArcGISConfig(): ArcGISStoredConfig {
  const state = useIntegrationConfig.getState();
  return {
    portalUrl:    process.env.ARCGIS_PORTAL_URL    || state.arcgis.portalUrl,
    username:     process.env.ARCGIS_USER          || state.arcgis.username,
    password:     process.env.ARCGIS_PASS          || state.arcgis.password,
    clientId:     process.env.ARCGIS_CLIENT_ID     || state.arcgis.clientId,
    clientSecret: process.env.ARCGIS_CLIENT_SECRET || state.arcgis.clientSecret,
    featureServerUrl:
      process.env.ARCGIS_FEATURE_SERVER || state.arcgis.featureServerUrl,
    geometryServerUrl:
      process.env.ARCGIS_GEOM_SERVER || state.arcgis.geometryServerUrl,
  };
}
