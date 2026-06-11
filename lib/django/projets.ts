/**
 * lib/django/projets.ts — API projets / programmes / tâches
 */
import { djangoFetch, type PaginatedResponse } from './client';

export interface ProjetKPIs {
  total: number;
  en_cours: number;
  critiques: number;
  avancement_moyen: number;
  budget_total: number;
  montant_engage: number;
  montant_paye: number;
}

export interface Projet {
  id: number;
  code: string;
  libelle: string;
  statut: string;
  priorite: string;
  avancement: number;
  budget_revise: number;
  montant_engage: number;
  montant_paye: number;
  date_debut: string | null;
  date_fin_prevu: string | null;
  taux_consommation: number;
  chef_projet: number | null;
  chef_projet_nom: string | null;
  direction: string;
  updated_at: string;
  latitude?: number;
  longitude?: number;
}

export interface Tache {
  id: number;
  projet: number;
  libelle: string;
  statut: string;
  priorite: string;
  date_fin: string | null;
  avancement: number;
  responsable: number | null;
}

/** Récupère les KPIs du portefeuille */
export async function fetchKPIs(): Promise<ProjetKPIs> {
  return djangoFetch<ProjetKPIs>('/projets/kpis/');
}

/** Liste paginée des projets avec filtres optionnels */
export async function fetchProjets(params?: Record<string, string>): Promise<PaginatedResponse<Projet>> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return djangoFetch<PaginatedResponse<Projet>>(`/projets/${qs}`);
}

/** Détail d'un projet */
export async function fetchProjet(id: number): Promise<Projet> {
  return djangoFetch<Projet>(`/projets/${id}/`);
}

/** Tâches en retard ou à faire pour un utilisateur */
export async function fetchMesTaches(params?: Record<string, string>): Promise<PaginatedResponse<Tache>> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return djangoFetch<PaginatedResponse<Tache>>(`/taches/${qs}`);
}
