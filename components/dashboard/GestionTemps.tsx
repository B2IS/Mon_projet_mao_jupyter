'use client';
/**
 * GestionTemps.tsx — Gestion des temps & productivité (RescueTime + Google Maps)
 * Temps par projet (bureau/terrain), pulse de productivité, facturation au temps
 * des ingénieurs conseils + module Heures Supplémentaires avec justificatifs imprimables.
 * Accès : UAGL · Directeurs · Administrateurs.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Activity, MapPin, Banknote, Building2, Gauge, Navigation, Radio, CheckCircle2, Crosshair, AlertTriangle, FileText, Printer, Plus, Check, X, ChevronDown, ChevronUp, CalendarDays, Users, UserCheck, Search, RefreshCw, Phone, Camera, Image, Sparkles, Eye } from 'lucide-react';
import FeuilleDeTemps from '@/components/dashboard/FeuilleDeTemps';
import {
  useTempsStore, kpis, parCategorie, parHeure, parCollaborateur, fmtDuree, repartitionTriee,
  detecterHeuresSup, SEUIL_JOURNALIER_MIN, TYPE_HS_LABELS, type TypeHS, type JustificatifHS,
  type StatutPresence,
} from '@/lib/tempsStore';
import { capturerPositionTerrain, pointerDepuisSite, demarrerSuiviTerrainAuto, CONTEXTE_TRANSVERSE } from '@/lib/tempsTracker';

const PURPLE = '#3D1A6B', ORANGE = '#F47920', INK = '#0F172A', MUT = '#64748B';
const BORDER = '#E2E8F0';
const card: React.CSSProperties = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 16, minWidth: 0 };
const cfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
const num: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };

const STATUT_CFG: Record<StatutPresence, { label: string; c: string; bg: string; border: string }> = {
  present:              { label: 'Present',         c: '#15803D', bg: '#DCFCE7', border: '#BBF7D0' },
  terrain:              { label: 'Terrain',          c: '#0E7490', bg: '#CFFAFE', border: '#A5F3FC' },
  mission:              { label: 'Mission',          c: '#1D4ED8', bg: '#DBEAFE', border: '#BFDBFE' },
  absent_justifie:      { label: 'Abs. justifie',   c: '#B45309', bg: '#FEF3C7', border: '#FDE68A' },
  absent_non_justifie:  { label: 'Absent (NJ)',      c: '#B91C1C', bg: '#FEE2E2', border: '#FECACA' },
  conge:                { label: 'Conge',            c: '#64748B', bg: '#F1F5F9', border: '#E2E8F0' },
  non_declare:          { label: 'Non declare',      c: '#DC2626', bg: '#FFF1F2', border: '#FFE4E6' },
};

export default function GestionTemps() {
  const {
    entrees, seed, projetActif, setProjetActif, repartition, pingsGeo, sites,
    justificatifsHS, ajouterJustificatif, approuverJustificatif, supprimerJustificatif,
    ressourcesUAGL, validerTemps, mettreAJourStatut, rapportsPhoto, ajouterRapportPhoto, validerRapportPhoto,
  } = useTempsStore();

  // ── Photo terrain (chauffeurs & agents) ──────────────────────────────────
  const [photoModal, setPhotoModal] = useState<string | null>(null); // ressource.id
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoEtat, setPhotoEtat] = useState<'normal' | 'incident' | 'retard' | 'non_conforme'>('normal');
  const [photoObs, setPhotoObs] = useState('');
  const [photoSubmitting, setPhotoSubmitting] = useState(false);
  const [photoResult, setPhotoResult] = useState<{ rapportId: string; anomalies: string[]; taux: number; etat: string } | null>(null);
  const [showRapports, setShowRapports] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetPhotoForm() {
    setPhotoPreview(''); setPhotoCaption(''); setPhotoEtat('normal'); setPhotoObs(''); setPhotoResult(null);
  }

  async function handlePhotoSubmit(ressourceId: string) {
    const r = ressourcesUAGL.find(x => x.id === ressourceId);
    if (!r) return;
    setPhotoSubmitting(true);
    // Simulated IA delay
    await new Promise(res => setTimeout(res, 1800));
    const anomaliesList: Record<'normal' | 'incident' | 'retard' | 'non_conforme', string[]> = {
      normal: [],
      incident: ['Zone non balisee', 'EPI manquants sur 2 agents'],
      retard: ['Materiel non livre — poteau BTA manquant'],
      non_conforme: ['Raccordement BT non conforme NF C 14-100', 'Mise a la terre absente'],
    };
    const tauxMap: Record<'normal' | 'incident' | 'retard' | 'non_conforme', number> = {
      normal: 75 + Math.floor(Math.random() * 25),
      incident: 40 + Math.floor(Math.random() * 20),
      retard: 30 + Math.floor(Math.random() * 25),
      non_conforme: 20 + Math.floor(Math.random() * 30),
    };
    const etatMap: Record<'normal' | 'incident' | 'retard' | 'non_conforme', string> = {
      normal: 'Travaux en cours — conformes',
      incident: 'Incident detecte — intervention requise',
      retard: 'Retard constate sur planning',
      non_conforme: 'Non-conformite detectee',
    };
    const tsNow = Date.now();
    ajouterRapportPhoto({
      ressourceId: r.id, ressourceNom: `${r.prenom} ${r.nom}`, matricule: r.matricule,
      ts: tsNow, photoDataUrl: photoPreview, caption: photoCaption,
      localite: r.localite, projet: r.projet,
      etatTravaux: photoEtat, observations: photoObs,
    });
    setPhotoResult({
      rapportId: 'RP-' + tsNow.toString(36).toUpperCase(),
      anomalies: anomaliesList[photoEtat],
      taux: tauxMap[photoEtat],
      etat: etatMap[photoEtat],
    });
    setPhotoSubmitting(false);
  }
  useEffect(() => { if (!entrees.length || !ressourcesUAGL.length) seed(); }, [entrees.length, ressourcesUAGL.length, seed]);

  const rep = useMemo(() => repartitionTriee(repartition), [repartition]);
  const projets = useMemo(() => [...new Set([...sites.map(s => s.projet), ...Object.keys(repartition), projetActif])], [sites, repartition, projetActif]);
  const sitesParProjet = useMemo(() => {
    const m = new Map<string, typeof sites>();
    sites.forEach(s => { const a = m.get(s.projet) ?? []; a.push(s); m.set(s.projet, a as typeof sites); });
    return m;
  }, [sites]);
  const [geoMsg, setGeoMsg] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [vue, setVue] = useState<'feuille' | 'productivite'>('feuille');
  const [subVue, setSubVue] = useState<'equipe' | 'moi'>('equipe');
  const [filtreSearch, setFiltreSearch] = useState('');
  const [filtreProjet, setFiltreProjet] = useState('');
  const [filtreRegion, setFiltreRegion] = useState('');
  const [filtreStatut, setFiltreStatut] = useState<StatutPresence | ''>('');
  // Suivi terrain automatique (GPS continu) — façon RescueTime côté terrain.
  const [autoTerrain, setAutoTerrain] = useState(false);
  const stopAutoRef = React.useRef<null | (() => void)>(null);
  useEffect(() => {
    if (autoTerrain) {
      stopAutoRef.current = demarrerSuiviTerrainAuto(5, (p) => {
        setGeoMsg(p.dansGeofence
          ? `✓ Auto : sur site « ${p.projet} » — +5 min imputées (≈ ${p.distanceM} m).`
          : `Auto : hors géofence (site le plus proche ≈ ${p.distanceM} m) — temps non imputé.`);
      });
    } else {
      stopAutoRef.current?.(); stopAutoRef.current = null;
    }
    return () => { stopAutoRef.current?.(); stopAutoRef.current = null; };
  }, [autoTerrain]);

  const pointerReel = async () => {
    setBusy(true); setGeoMsg('Lecture de la position GPS…');
    const r = await capturerPositionTerrain(30);
    setBusy(false);
    if ('erreur' in r) { setGeoMsg(`⚠︎ ${r.erreur} — utilisez « simuler depuis un site ».`); return; }
    setGeoMsg(r.ping.dansGeofence
      ? `✓ Sur site « ${r.ping.projet} » (≈ ${r.ping.distanceM} m).`
      : `Hors géofence — site le plus proche à ≈ ${r.ping.distanceM} m.`);
  };

  const k = useMemo(() => kpis(entrees), [entrees]);
  const cats = useMemo(() => parCategorie(entrees), [entrees]);
  const heures = useMemo(() => parHeure(entrees), [entrees]);
  const collabs = useMemo(() => parCollaborateur(entrees), [entrees]);
  const maxHeure = Math.max(1, ...heures);
  const hsDetectes = useMemo(() => detecterHeuresSup(entrees), [entrees]);
  const filteredRessources = useMemo(() => {
    let list = ressourcesUAGL;
    if (filtreSearch.trim()) {
      const q = filtreSearch.trim().toLowerCase();
      list = list.filter(r => `${r.nom} ${r.prenom} ${r.matricule}`.toLowerCase().includes(q));
    }
    if (filtreProjet) list = list.filter(r => r.projet === filtreProjet);
    if (filtreRegion) list = list.filter(r => r.region === filtreRegion);
    if (filtreStatut) list = list.filter(r => r.statut === filtreStatut);
    return list;
  }, [ressourcesUAGL, filtreSearch, filtreProjet, filtreRegion, filtreStatut]);

  return (
    <div style={{ padding: 20, maxWidth: 1320, margin: '0 auto', width: '100%' }}>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ width: 42, height: 42, borderRadius: 11, background: `${PURPLE}14`, display: 'grid', placeItems: 'center' }}>
          <Clock size={22} style={{ color: PURPLE }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 21, fontWeight: 800, color: INK, margin: 0 }}>Gestion des temps & productivité</h1>
          <p style={{ fontSize: 13, color: MUT, margin: '2px 0 0' }}>
            Temps passé par projet — bureau & terrain — et facturation au temps des ingénieurs conseils.
          </p>
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: '#15803D', background: '#DCFCE7', padding: '6px 12px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: '#16A34A' }} /> Suivi temps réel
        </span>
      </div>

      {/* Onglets : Feuille de temps (timesheet) | Productivité & terrain */}
      <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${BORDER}`, marginBottom: 18 }}>
        {([
          { id: 'feuille' as const,      label: 'Feuille de temps',       icon: <CalendarDays size={14} /> },
          { id: 'productivite' as const, label: 'Suivi & Productivite',  icon: <Users size={14} /> },
        ]).map(t => (
          <button key={t.id} onClick={() => setVue(t.id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px',
              border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: vue === t.id ? 700 : 500,
              color: vue === t.id ? ORANGE : '#64748B',
              borderBottom: vue === t.id ? `2px solid ${ORANGE}` : '2px solid transparent',
              marginBottom: -1,
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {vue === 'feuille' && <FeuilleDeTemps />}

      {vue === 'productivite' && <>

        {/* ── Onglets internes : Supervision N+1 | Mon Activite ── */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '1px solid #E2E8F0' }}>
          {([
            { id: 'equipe' as const,  label: 'Supervision Equipe — N+1', icon: <Users size={13} /> },
            { id: 'moi' as const,     label: 'Mon Activite & Terrain',    icon: <Activity size={13} /> },
          ]).map(t => (
            <button key={t.id} onClick={() => setSubVue(t.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 16px',
                border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 12.5, fontWeight: subVue === t.id ? 700 : 500,
                color: subVue === t.id ? PURPLE : '#64748B',
                borderBottom: subVue === t.id ? `2px solid ${PURPLE}` : '2px solid transparent',
                marginBottom: -1, transition: 'color 0.15s',
              }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════
            SUPERVISION EQUIPE — VUE N+1 / UAGL
        ════════════════════════════════════════════════════ */}
        {subVue === 'equipe' && <>

          {/* KPI Statuts — cliquables pour filtrer */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
            {([
              { key: 'present' as const,              icon: <UserCheck size={14} /> },
              { key: 'terrain' as const,              icon: <MapPin size={14} /> },
              { key: 'mission' as const,              icon: <Navigation size={14} /> },
              { key: 'absent_justifie' as const,      icon: <FileText size={14} /> },
              { key: 'absent_non_justifie' as const,  icon: <AlertTriangle size={14} /> },
              { key: 'non_declare' as const,          icon: <Crosshair size={14} /> },
              { key: 'conge' as const,                icon: <CalendarDays size={14} /> },
            ]).map(s => {
              const cfg = STATUT_CFG[s.key];
              const count = ressourcesUAGL.filter(r => r.statut === s.key).length;
              const isActive = filtreStatut === s.key;
              return (
                <button key={s.key}
                  onClick={() => setFiltreStatut(isActive ? '' : s.key)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '9px 14px', borderRadius: 11, background: isActive ? cfg.bg : '#FAFBFC', border: `1.5px solid ${isActive ? cfg.border : '#E8ECF4'}`, cursor: 'pointer', transition: 'all 0.15s', boxShadow: isActive ? '0 2px 6px rgba(0,0,0,0.07)' : 'none', fontFamily: 'inherit' }}>
                  <span style={{ color: cfg.c }}>{s.icon}</span>
                  <span>
                    <span style={{ display: 'block', fontSize: 20, fontWeight: 800, color: cfg.c, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
                    <span style={{ display: 'block', fontSize: 10, color: '#64748B', marginTop: 2, fontWeight: isActive ? 700 : 400 }}>{cfg.label}</span>
                  </span>
                </button>
              );
            })}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: MUT }}>{ressourcesUAGL.length} ressources</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#15803D', background: '#DCFCE7', padding: '4px 10px', borderRadius: 20 }}>
                {ressourcesUAGL.filter(r => r.valideParN1).length} validees N+1
              </span>
            </div>
          </div>

          {/* Barre de filtres */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
              <input type="text" placeholder="Nom, matricule..." value={filtreSearch} onChange={e => setFiltreSearch(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', paddingLeft: 32, paddingRight: 10, paddingTop: 8, paddingBottom: 8, borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 12.5, color: INK, background: '#fff', outline: 'none' }} />
            </div>
            <select value={filtreProjet} onChange={e => setFiltreProjet(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 12, color: filtreProjet ? INK : '#94A3B8', background: '#fff', cursor: 'pointer', minWidth: 165 }}>
              <option value="">Tous projets</option>
              {[...new Set(ressourcesUAGL.map(r => r.projet))].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={filtreRegion} onChange={e => setFiltreRegion(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 12, color: filtreRegion ? INK : '#94A3B8', background: '#fff', cursor: 'pointer', minWidth: 130 }}>
              <option value="">Toutes regions</option>
              {[...new Set(ressourcesUAGL.map(r => r.region))].map(rg => <option key={rg} value={rg}>{rg}</option>)}
            </select>
            {(filtreSearch || filtreProjet || filtreRegion || filtreStatut) && (
              <button onClick={() => { setFiltreSearch(''); setFiltreProjet(''); setFiltreRegion(''); setFiltreStatut(''); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', background: '#F8FAFC', fontSize: 11.5, color: '#64748B', cursor: 'pointer', fontFamily: 'inherit' }}>
                <X size={12} /> Effacer
              </button>
            )}
            <span style={{ fontSize: 11.5, color: MUT, marginLeft: 4 }}>{filteredRessources.length} / {ressourcesUAGL.length}</span>
          </div>

          {/* Liste des ressources */}
          {filteredRessources.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', gap: 10, color: '#CBD5E1' }}>
              <Users size={40} style={{ opacity: 0.3 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: '#94A3B8' }}>Aucune ressource correspondante</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
              {filteredRessources.map(r => {
                const initiales = `${r.nom} ${r.prenom}`.split(' ').map((w: string) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
                const scfg = STATUT_CFG[r.statut];
                const pctTemps = r.tempsLoggeMin > 0 ? Math.min(Math.round((r.tempsLoggeMin / 480) * 100), 100) : 0;
                const tempsCouleur = pctTemps >= 80 ? '#15803D' : pctTemps >= 40 ? ORANGE : (pctTemps > 0 ? '#DC2626' : '#CBD5E1');
                return (
                  <div key={r.id} style={{ background: '#fff', border: '1px solid #E8ECF4', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', flexWrap: 'wrap' }}>

                    {/* Avatar */}
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: `linear-gradient(135deg, ${PURPLE}22, ${ORANGE}22)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: PURPLE, flexShrink: 0, border: `2px solid ${scfg.border}` }}>
                      {initiales}
                    </div>

                    {/* Identite */}
                    <div style={{ flex: '0 0 165px', minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.prenom} {r.nom}</div>
                      <div style={{ fontSize: 10.5, color: MUT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.matricule} · {r.fonction}</div>
                    </div>

                    {/* Localite */}
                    <div style={{ flex: '0 0 125px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={10} style={{ color: MUT, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.localite}</span>
                      </div>
                      <div style={{ fontSize: 10, color: MUT, marginTop: 2 }}>{r.region}</div>
                    </div>

                    {/* Statut */}
                    <div style={{ flex: '0 0 135px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: scfg.c, background: scfg.bg, padding: '4px 10px', borderRadius: 20, border: `1px solid ${scfg.border}` }}>
                        <span style={{ width: 6, height: 6, borderRadius: 99, background: scfg.c, flexShrink: 0 }} />
                        {scfg.label}
                      </span>
                      {r.valideParN1 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 4, fontSize: 10, color: '#15803D' }}>
                          <CheckCircle2 size={10} /> Valide N+1
                        </div>
                      )}
                    </div>

                    {/* Dernier ping GPS */}
                    <div style={{ flex: '0 0 150px', minWidth: 0 }}>
                      {r.dernierPingGPS ? (
                        <>
                          <div style={{ fontSize: 11.5, fontWeight: 600, color: '#0E7490', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.dernierPingGPS}</div>
                          <div style={{ fontSize: 10, color: MUT }}>Ping {r.dernierPingHeure}</div>
                        </>
                      ) : (
                        <div style={{ fontSize: 11, color: '#CBD5E1', fontStyle: 'italic' }}>Pas de ping GPS</div>
                      )}
                    </div>

                    {/* Temps loggé / barre */}
                    <div style={{ flex: 1, minWidth: 100 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: tempsCouleur, fontVariantNumeric: 'tabular-nums' }}>{fmtDuree(r.tempsLoggeMin)}</span>
                        <span style={{ fontSize: 10, color: MUT }}>/ 8h ({pctTemps}%)</span>
                      </div>
                      <div style={{ height: 5, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ width: `${pctTemps}%`, height: '100%', background: tempsCouleur, borderRadius: 99, transition: 'width 0.4s ease' }} />
                      </div>
                      {r.heureArrivee && (
                        <div style={{ fontSize: 9.5, color: MUT, marginTop: 3 }}>Arrivee {r.heureArrivee}{r.heureDepart ? ` — Depart ${r.heureDepart}` : ''}</div>
                      )}
                    </div>

                    {/* Actions N+1 */}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                      {!r.valideParN1 && r.tempsLoggeMin > 0 && (
                        <button onClick={() => validerTemps(r.id)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, background: '#DCFCE7', color: '#15803D', border: '1px solid #BBF7D0', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          <Check size={11} /> Valider
                        </button>
                      )}
                      {(r.statut === 'non_declare' || r.statut === 'absent_non_justifie') && (
                        <button onClick={() => mettreAJourStatut(r.id, 'absent_justifie', 'Relance N+1')}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, background: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          <RefreshCw size={11} /> Relancer
                        </button>
                      )}
                      {r.telephone && (
                        <a href={`tel:${r.telephone}`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>
                          <Phone size={11} /> Appeler
                        </a>
                      )}
                      {/* Rapport photo — disponible pour tous les agents terrain */}
                      {(r.statut === 'terrain' || r.statut === 'mission' || r.fonction.toLowerCase().includes('chauffeur')) && (
                        <button onClick={() => { resetPhotoForm(); setPhotoModal(r.id); }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, background: '#FFF7ED', color: '#F47920', border: '1px solid #FED7AA', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          <Camera size={11} /> Photo terrain
                        </button>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#F8FAFC', borderRadius: 8, fontSize: 11, color: '#94A3B8', flexWrap: 'wrap' }}>
            <AlertTriangle size={12} />
            <span style={{ flex: 1 }}>Vue N+1 — Supervisez les temps et la presence des ressources UAGL affectees. Cliquez sur un statut pour filtrer.</span>
            {rapportsPhoto.length > 0 && (
              <button onClick={() => setShowRapports(v => !v)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, background: '#FFF7ED', color: '#F47920', border: '1px solid #FED7AA', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Image size={11} /> {rapportsPhoto.length} rapport{rapportsPhoto.length > 1 ? 's' : ''} photo recu{rapportsPhoto.length > 1 ? 's' : ''}
              </button>
            )}
          </div>

          {/* Rapports photo recus */}
          {showRapports && rapportsPhoto.length > 0 && (
            <div style={{ marginTop: 12, border: '1.5px solid #FED7AA', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ background: '#FFF7ED', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #FED7AA' }}>
                <Camera size={14} style={{ color: '#F47920' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', flex: 1 }}>Rapports photo terrain</span>
                <button onClick={() => setShowRapports(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={14} /></button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {rapportsPhoto.map((rp, idx) => {
                  const ETAT_CFG = {
                    normal: { label: 'Normal', c: '#15803D', bg: '#DCFCE7' },
                    incident: { label: 'Incident', c: '#B91C1C', bg: '#FEE2E2' },
                    retard: { label: 'Retard', c: '#B45309', bg: '#FEF3C7' },
                    non_conforme: { label: 'Non conforme', c: '#7C3AED', bg: '#EDE9FE' },
                  };
                  const ec = ETAT_CFG[rp.etatTravaux];
                  return (
                    <div key={rp.id} style={{ padding: '12px 16px', borderBottom: idx < rapportsPhoto.length - 1 ? '1px solid #F1F5F9' : 'none', display: 'flex', gap: 14, alignItems: 'flex-start', background: '#fff' }}>
                      {rp.photoDataUrl ? (
                        <img src={rp.photoDataUrl} alt="terrain" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: '1px solid #E2E8F0' }} />
                      ) : (
                        <div style={{ width: 56, height: 56, borderRadius: 8, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Camera size={20} style={{ color: '#CBD5E1' }} /></div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A' }}>{rp.ressourceNom}</span>
                          <span style={{ fontSize: 10, color: '#64748B' }}>{rp.matricule}</span>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: ec.c, background: ec.bg, padding: '2px 8px', borderRadius: 12 }}>{ec.label}</span>
                          {rp.valideParN1 && <span style={{ fontSize: 10, fontWeight: 700, color: '#15803D' }}>✓ Valide</span>}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#374151', marginBottom: 3 }}>{rp.caption || rp.projet + ' — ' + rp.localite}</div>
                        {rp.observations && <div style={{ fontSize: 11, color: '#64748B', fontStyle: 'italic' }}>{rp.observations}</div>}
                        {rp.iaTraite && rp.iaExtraction && (
                          <div style={{ marginTop: 6, padding: '6px 10px', background: '#F0F9FF', borderRadius: 7, fontSize: 10.5, color: '#0E7490', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <Sparkles size={11} />
                            <span><strong>IA:</strong> {rp.iaExtraction.etatDetecte}</span>
                            {rp.iaExtraction.tauxAvancement !== undefined && <span>Avancement: {rp.iaExtraction.tauxAvancement}%</span>}
                            {rp.iaExtraction.anomalies.length > 0 && <span style={{ color: '#DC2626' }}>⚠ {rp.iaExtraction.anomalies.join(', ')}</span>}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
                        <span style={{ fontSize: 9.5, color: '#94A3B8', textAlign: 'right' }}>{new Date(rp.ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                        {!rp.valideParN1 && (
                          <button onClick={() => validerRapportPhoto(rp.id)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 6, background: '#DCFCE7', color: '#15803D', border: '1px solid #BBF7D0', fontSize: 10.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                            <Check size={10} /> Valider
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>}

        {/* ════════════════════════════════════════════════════
            MON ACTIVITE PERSONNELLE (vue individuelle)
        ════════════════════════════════════════════════════ */}
        {subVue === 'moi' && <>

      {/* ══ HERO : Pulse + Métriques + Timeline horaire ═══════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 0, marginBottom: 16, background: 'var(--surface, #fff)', borderRadius: 14, border: '1px solid #E8ECF4', overflow: 'hidden', boxShadow: '0 2px 8px rgba(15,52,96,0.06)' }} className="gt-hero">
        {/* Panneau gauche : Score pulse */}
        <div style={{ padding: '22px 24px', borderRight: '1px solid #EEF2F7', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 180, background: 'linear-gradient(160deg, #FAF8FF 0%, #F5F0FF 100%)' }}>
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
            <svg width={96} height={96} viewBox="0 0 96 96">
              <circle cx={48} cy={48} r={40} fill="none" stroke="#E8E0F7" strokeWidth={8} />
              <circle cx={48} cy={48} r={40} fill="none"
                stroke={k.pulse >= 70 ? '#16A34A' : k.pulse >= 50 ? ORANGE : '#EF4444'}
                strokeWidth={8} strokeLinecap="round"
                strokeDasharray={`${(k.pulse / 100) * 251.3} 251.3`}
                transform="rotate(-90 48 48)"
                style={{ transition: 'stroke-dasharray 0.8s ease' }}
              />
            </svg>
            <div style={{ position: 'absolute', textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: k.pulse >= 70 ? '#16A34A' : k.pulse >= 50 ? ORANGE : '#EF4444', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{k.pulse}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>/100</div>
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 4, textAlign: 'center' }}>{labelPulse(k.pulse)}</div>
          <div style={{ fontSize: 10.5, color: MUT, textAlign: 'center', lineHeight: 1.4 }}>Score de productivité</div>
          <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
            {[{ c: '#16A34A', l: 'Élevée' }, { c: ORANGE, l: 'Normale' }, { c: '#EF4444', l: 'Faible' }].map(x => (
              <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: MUT }}>
                <div style={{ width: 6, height: 6, borderRadius: 99, background: x.c }} />
                {x.l}
              </div>
            ))}
          </div>
        </div>

        {/* Panneau droit : Métriques + Timeline */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Métriques principales */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: 36, fontWeight: 800, color: INK, lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{fmtDuree(k.totalMin)}</div>
              <div style={{ fontSize: 12, color: MUT, marginTop: 5 }}>
                loggés aujourd'hui
                <span style={{ marginLeft: 8, background: '#EFF6FF', color: '#1D4ED8', fontWeight: 700, fontSize: 11, padding: '2px 7px', borderRadius: 20 }}>
                  {k.nbCollaborateurs} collaborateurs actifs
                </span>
              </div>
            </div>
            {/* 4 compteurs compacts */}
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[
                { icon: <Building2 size={13} />, label: 'Bureau', value: fmtDuree(k.bureauMin), color: '#2563EB', bg: '#EFF6FF' },
                { icon: <MapPin size={13} />, label: 'Terrain', value: fmtDuree(k.terrainMin), color: '#0E7490', bg: '#ECFEFF' },
                { icon: <Banknote size={13} />, label: 'Facturable', value: fmtDuree(k.facturableMin), color: '#15803D', bg: '#F0FDF4' },
                { icon: <Activity size={13} />, label: 'Montant', value: cfa(k.montantFacturable), color: ORANGE, bg: '#FFF7ED' },
              ].map(m => (
                <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: m.color, flexShrink: 0 }}>
                    {m.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: m.color, fontVariantNumeric: 'tabular-nums' }}>{m.value}</div>
                    <div style={{ fontSize: 10, color: MUT }}>{m.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline horaire */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: MUT, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Activité par heure</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 48 }}>
              {heures.map((m, h) => (
                <div key={h} title={`${h}h00 — ${fmtDuree(m)}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'default' }}>
                  <div style={{
                    width: '100%',
                    height: `${maxHeure > 0 ? Math.max((m / maxHeure) * 36, m > 0 ? 4 : 0) : 0}px`,
                    background: m > 0
                      ? h === new Date().getHours()
                        ? `linear-gradient(180deg,${PURPLE},#A78BFA)`
                        : `linear-gradient(180deg,${ORANGE}CC,#FBBF7799)`
                      : '#F1F5F9',
                    borderRadius: '3px 3px 2px 2px',
                    transition: 'height 0.3s ease',
                  }} />
                  <span style={{ fontSize: 9, color: h % 4 === 0 ? '#94A3B8' : 'transparent', lineHeight: 1 }}>{h}h</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ══ TRACKING : Plateforme + Terrain ══════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }} className="gt-cols">

        {/* — Suivi plateforme — */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* En-tête */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(244,121,32,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Radio size={15} style={{ color: ORANGE }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>Suivi plateforme</div>
              <div style={{ fontSize: 10.5, color: MUT }}>Temps actif détecté à la navigation</div>
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, color: '#15803D', background: '#DCFCE7', padding: '3px 9px', borderRadius: 20, flexShrink: 0 }}>
              <span className="gt-blink" style={{ width: 6, height: 6, borderRadius: 99, background: '#16A34A', display: 'inline-block' }} /> En cours
            </span>
          </div>

          {/* Projet actif détecté */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 9, marginBottom: 12, border: `1.5px solid ${projetActif === CONTEXTE_TRANSVERSE ? '#E2E8F0' : '#BBF7D0'}`, background: projetActif === CONTEXTE_TRANSVERSE ? '#F8FAFC' : '#F0FDF4' }}>
            <Crosshair size={13} style={{ color: projetActif === CONTEXTE_TRANSVERSE ? MUT : '#15803D', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, color: MUT, marginBottom: 1 }}>Projet détecté automatiquement</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: projetActif === CONTEXTE_TRANSVERSE ? '#64748B' : '#15803D', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {projetActif === CONTEXTE_TRANSVERSE ? 'Temps transverse (hors projet)' : projetActif}
              </div>
            </div>
          </div>

          {/* Sélecteur projet */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 10.5, fontWeight: 600, color: MUT, display: 'block', marginBottom: 5 }}>
              Modifier le projet imputé
            </label>
            <select value={projetActif} onChange={e => setProjetActif(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 12.5, fontWeight: 600, color: INK, background: '#fff', outline: 'none', cursor: 'pointer' }}>
              {[...new Set([CONTEXTE_TRANSVERSE, ...projets])].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Barres de répartition */}
          <div style={{ fontSize: 10.5, fontWeight: 600, color: MUT, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Répartition du temps</div>
          <div style={{ display: 'grid', gap: 10, flex: 1 }}>
            {rep.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px', background: '#F8FAFC', borderRadius: 8, fontSize: 11.5, color: '#94A3B8' }}>
                <Radio size={14} /> Le temps s'accumule automatiquement. Naviguez dans la plateforme…
              </div>
            ) : rep.map(r => (
              <div key={r.projet}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                    {r.projet === projetActif && (
                      <div style={{ width: 6, height: 6, borderRadius: 99, background: PURPLE, flexShrink: 0 }} />
                    )}
                    <span style={{ fontSize: 11.5, color: r.projet === projetActif ? PURPLE : '#334155', fontWeight: r.projet === projetActif ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.projet}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: MUT, fontVariantNumeric: 'tabular-nums', flexShrink: 0, marginLeft: 8 }}>
                    {r.pct}% · <strong style={{ color: INK }}>{fmtDuree(r.min)}</strong>
                  </span>
                </div>
                <div style={{ height: 6, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ width: `${r.pct}%`, height: '100%', background: r.projet === projetActif ? `linear-gradient(90deg,${PURPLE},${ORANGE})` : '#C4B5FD', borderRadius: 99, transition: 'width 0.4s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* — Présence terrain géolocalisée — */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* En-tête */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(14,116,144,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Navigation size={15} style={{ color: '#0E7490' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>Présence terrain</div>
              <div style={{ fontSize: 10.5, color: MUT }}>Géolocalisation GPS continue</div>
            </div>
            <button onClick={() => setAutoTerrain(v => !v)}
              title="Relève GPS automatique toutes les 5 min"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 11, border: `1.5px solid ${autoTerrain ? '#0E7490' : '#CBD5E1'}`, background: autoTerrain ? '#0E7490' : '#F8FAFC', color: autoTerrain ? '#fff' : '#64748B', transition: 'all 0.15s' }}>
              <span className={autoTerrain ? 'gt-blink' : ''} style={{ width: 7, height: 7, borderRadius: 99, background: autoTerrain ? '#A7F3D0' : '#CBD5E1', display: 'inline-block' }} />
              Suivi auto {autoTerrain ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Actions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <button onClick={pointerReel} disabled={busy}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 12px', borderRadius: 9, background: '#0E7490', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: busy ? 'wait' : 'pointer', transition: 'opacity 0.2s', opacity: busy ? 0.7 : 1 }}>
              <Crosshair size={13} /> Ma position
            </button>
            <select onChange={e => { const s = sites.find(x => `${x.lat},${x.lng}` === e.target.value); if (s) { pointerDepuisSite(s.lat, s.lng, 30); setGeoMsg(`✓ Pointage simulé — ${s.projet}`); } e.currentTarget.selectedIndex = 0; }}
              style={{ padding: '9px 10px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 11.5, color: '#475569', background: '#fff', cursor: 'pointer' }}>
              <option>Simuler un site…</option>
              {sites.map(s => <option key={`${s.lat},${s.lng}`} value={`${s.lat},${s.lng}`}>{s.projet}</option>)}
            </select>
          </div>

          {/* Message retour GPS */}
          {geoMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8, marginBottom: 10, fontSize: 11.5, color: '#15803D', fontWeight: 600 }}>
              <CheckCircle2 size={13} /> {geoMsg}
            </div>
          )}

          {/* Liste pings GPS */}
          <div style={{ fontSize: 10.5, fontWeight: 600, color: MUT, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
            Pings GPS récents {pingsGeo.length > 0 && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>({pingsGeo.length})</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', maxHeight: 192 }}>
            {pingsGeo.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, background: '#F8FAFC', borderRadius: 8, fontSize: 11.5, color: '#94A3B8' }}>
                <MapPin size={14} /> Aucun ping. Activez le suivi ou pointez manuellement.
              </div>
            ) : pingsGeo.slice(0, 8).map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: `1px solid ${p.dansGeofence ? '#BBF7D0' : '#E8ECF4'}`, borderRadius: 8, background: p.dansGeofence ? '#F0FDF4' : '#F8FAFC' }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: p.dansGeofence ? '#DCFCE7' : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {p.dansGeofence
                    ? <CheckCircle2 size={13} style={{ color: '#16A34A' }} />
                    : <MapPin size={13} style={{ color: '#94A3B8' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: p.dansGeofence ? '#15803D' : '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.projet ?? 'Hors site'}
                  </div>
                  <div style={{ fontSize: 10, color: MUT, fontVariantNumeric: 'tabular-nums' }}>
                    {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: p.dansGeofence ? '#15803D' : '#94A3B8', fontVariantNumeric: 'tabular-nums' }}>≈ {p.distanceM} m</div>
                  <div style={{ fontSize: 9, color: p.dansGeofence ? '#16A34A' : '#94A3B8' }}>{p.dansGeofence ? 'Sur site' : 'Hors périmètre'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ CATÉGORIES + ÉQUIPE ══════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 14, marginBottom: 14 }} className="gt-cols">

        {/* Répartition par catégorie */}
        <div style={{ ...card }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(61,26,107,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={14} style={{ color: PURPLE }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>Par catégorie</div>
              <div style={{ fontSize: 10.5, color: MUT }}>Style RescueTime</div>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {cats.map(c => (
              <div key={c.cat}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: c.couleur, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#334155', fontWeight: 600 }}>{c.cat}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: c.couleur, fontVariantNumeric: 'tabular-nums' }}>{c.pct}%</span>
                    <span style={{ fontSize: 10, color: MUT, fontVariantNumeric: 'tabular-nums' }}>{fmtDuree(c.min)}</span>
                  </div>
                </div>
                <div style={{ height: 7, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ width: `${c.pct}%`, height: '100%', background: c.couleur, borderRadius: 99, transition: 'width 0.5s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Équipes & ingénieurs conseils */}
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Building2 size={14} style={{ color: '#2563EB' }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>Équipes & ingénieurs conseils</div>
                <div style={{ fontSize: 10.5, color: MUT }}>{collabs.length} collaborateurs suivis aujourd'hui</div>
              </div>
            </div>
          </div>
          {/* Cartes collaborateurs */}
          <div style={{ display: 'grid', gap: 0 }}>
            {collabs.map((c, i) => {
              const initiales = c.nom.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
              const pulseColor = c.pulse >= 70 ? '#16A34A' : c.pulse >= 50 ? ORANGE : '#EF4444';
              const pulseBg = c.pulse >= 70 ? '#DCFCE7' : c.pulse >= 50 ? '#FFF7ED' : '#FEE2E2';
              return (
                <div key={c.nom} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderTop: i > 0 ? '1px solid #F1F5F9' : 'none' }}>
                  {/* Avatar */}
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${PURPLE}22 0%, ${ORANGE}22 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: PURPLE, flexShrink: 0 }}>
                    {initiales}
                  </div>
                  {/* Nom + Fonction */}
                  <div style={{ flex: '0 0 160px', minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nom}</div>
                    <div style={{ fontSize: 10.5, color: MUT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.fonction}</div>
                  </div>
                  {/* Pulse badge */}
                  <div style={{ flex: '0 0 64px', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: pulseColor, background: pulseBg, padding: '2px 8px', borderRadius: 8, fontVariantNumeric: 'tabular-nums' }}>{c.pulse}</span>
                  </div>
                  {/* Temps total + barre */}
                  <div style={{ flex: 1, minWidth: 80 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: INK, fontVariantNumeric: 'tabular-nums' }}>{fmtDuree(c.totalMin)}</span>
                      {c.terrainMin > 0 && (
                        <span style={{ fontSize: 10, color: '#0E7490', fontVariantNumeric: 'tabular-nums' }}>
                          <MapPin size={9} style={{ verticalAlign: 'middle' }} /> {fmtDuree(c.terrainMin)}
                        </span>
                      )}
                    </div>
                    <div style={{ height: 5, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min((c.totalMin / (8 * 60)) * 100, 100)}%`, height: '100%', background: pulseColor, borderRadius: 99 }} />
                    </div>
                  </div>
                  {/* Facturable */}
                  <div style={{ flex: '0 0 110px', textAlign: 'right' }}>
                    {c.facturable
                      ? <span style={{ fontSize: 12, fontWeight: 700, color: '#15803D', background: '#F0FDF4', padding: '3px 8px', borderRadius: 7, fontVariantNumeric: 'tabular-nums' }}>{cfa(c.montant)}</span>
                      : <span style={{ fontSize: 11, color: '#94A3B8', background: '#F8FAFC', padding: '3px 8px', borderRadius: 7 }}>Interne</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══ MODULE HEURES SUPPLÉMENTAIRES ══════════════════════════════════ */}
      <HeureSuppSection
        detections={hsDetectes}
        justificatifs={justificatifsHS}
        onAjouter={ajouterJustificatif}
        onApprouver={approuverJustificatif}
        onSupprimer={supprimerJustificatif}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, padding: '8px 12px', background: '#F8FAFC', borderRadius: 8, fontSize: 11, color: '#94A3B8' }}>
        <Gauge size={12} />
        <span>Inspire de <strong>RescueTime</strong> (productivite) et <strong>Google Maps</strong> (presence terrain geolocalisee). Donnees de demonstration — connectable au pointage reel et aux ODM valides.</span>
      </div>
        </>}{/* end subVue moi */}
      </>}{/* end vue productivite */}

      <style>{`
        @media (max-width: 860px) {
          .gt-hero { grid-template-columns: 1fr !important; }
          .gt-cols { grid-template-columns: 1fr !important; }
        }
        @keyframes gtBlink { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
        .gt-blink { animation: gtBlink 1.4s ease-in-out infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* ══ MODALE RAPPORT PHOTO TERRAIN ══════════════════════════════════ */}
      {photoModal && (() => {
        const r = ressourcesUAGL.find((x: typeof ressourcesUAGL[0]) => x.id === photoModal);
        if (!r) return null;
        const isChauffeur = r.fonction.toLowerCase().includes('chauffeur');
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 16px' }}
            onClick={e => { if (e.target === e.currentTarget && !photoSubmitting) { setPhotoModal(null); resetPhotoForm(); } }}>
            <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, boxShadow: '0 24px 64px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
              <div style={{ background: `linear-gradient(135deg, ${ORANGE} 0%, #E85D04 100%)`, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <Camera size={20} style={{ color: '#fff' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>Rapport photo terrain</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>{r.prenom} {r.nom} &middot; {r.localite}</div>
                </div>
                {!photoSubmitting && (
                  <button onClick={() => { setPhotoModal(null); resetPhotoForm(); }} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 7, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}><X size={14} /></button>
                )}
              </div>
              <div style={{ padding: '20px' }}>
                {photoResult ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 10 }}>
                      <CheckCircle2 size={18} style={{ color: '#15803D', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#15803D' }}>Rapport envoye &mdash; analyse IA terminee</div>
                        <div style={{ fontSize: 11, color: '#166534' }}>Ref : {photoResult.rapportId}</div>
                      </div>
                    </div>
                    <div style={{ border: '1.5px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ background: '#F0F9FF', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #E2E8F0' }}>
                        <Sparkles size={14} style={{ color: '#0E7490' }} />
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0E7490' }}>Analyse IA &mdash; resultats</span>
                      </div>
                      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div>
                          <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>Etat detecte</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{photoResult.etat}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Taux avancement estime</div>
                          <div style={{ height: 8, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden', marginBottom: 3 }}>
                            <div style={{ width: `${photoResult.taux}%`, height: '100%', background: photoResult.taux >= 70 ? '#15803D' : photoResult.taux >= 40 ? ORANGE : '#DC2626', borderRadius: 99 }} />
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{photoResult.taux}%</div>
                        </div>
                        {photoResult.anomalies.length > 0 && (
                          <div>
                            <div style={{ fontSize: 10, color: '#B91C1C', fontWeight: 700, textTransform: 'uppercase', marginBottom: 5 }}>Anomalies detectees</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {photoResult.anomalies.map((a: string, i: number) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#7F1D1D', background: '#FEF2F2', padding: '5px 9px', borderRadius: 7 }}>
                                  <AlertTriangle size={11} style={{ color: '#DC2626', flexShrink: 0 }} /> {a}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button onClick={() => resetPhotoForm()} style={{ padding: '8px 14px', background: '#FFF7ED', color: ORANGE, border: '1.5px solid #FED7AA', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>
                        <Camera size={12} /> Nouveau
                      </button>
                      <button onClick={() => { setPhotoModal(null); resetPhotoForm(); }} style={{ padding: '8px 14px', background: PURPLE, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Fermer
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                        Photo du site{isChauffeur ? ' (depuis le terrain)' : ''}
                      </div>
                      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          const reader = new FileReader();
                          reader.onload = ev => setPhotoPreview(ev.target?.result as string);
                          reader.readAsDataURL(f);
                        }} />
                      {photoPreview ? (
                        <div style={{ position: 'relative' }}>
                          <img src={photoPreview} alt="preview" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 10, display: 'block' }} />
                          <button onClick={() => setPhotoPreview('')} style={{ position: 'absolute', top: 7, right: 7, background: 'rgba(15,23,42,0.6)', border: 'none', borderRadius: 6, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}><X size={13} /></button>
                        </div>
                      ) : (
                        <button onClick={() => fileInputRef.current?.click()}
                          style={{ width: '100%', border: '2px dashed #FED7AA', borderRadius: 10, padding: '28px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#FFFBF5', cursor: 'pointer', fontFamily: 'inherit' }}>
                          <Camera size={28} style={{ color: ORANGE }} />
                          <div style={{ fontSize: 13, fontWeight: 600, color: ORANGE }}>Prendre une photo ou charger</div>
                          <div style={{ fontSize: 11, color: '#94A3B8' }}>JPG, PNG &mdash; site / travaux / incident</div>
                        </button>
                      )}
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Legende</label>
                      <input type="text" value={photoCaption} onChange={e => setPhotoCaption(e.target.value)}
                        placeholder="ex: Pose cable BT axe Ziguinchor-Sedhiou km14..."
                        style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 12.5, color: '#0F172A', background: '#fff', outline: 'none' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Etat des travaux</label>
                      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                        {([
                          { v: 'normal' as const, l: 'Normal', c: '#15803D', bg: '#DCFCE7', b: '#BBF7D0' },
                          { v: 'retard' as const, l: 'Retard', c: '#B45309', bg: '#FEF3C7', b: '#FDE68A' },
                          { v: 'incident' as const, l: 'Incident', c: '#B91C1C', bg: '#FEE2E2', b: '#FECACA' },
                          { v: 'non_conforme' as const, l: 'Non conforme', c: '#7C3AED', bg: '#EDE9FE', b: '#DDD6FE' },
                        ]).map(opt => (
                          <button key={opt.v} onClick={() => setPhotoEtat(opt.v)}
                            style={{ padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${photoEtat === opt.v ? opt.b : '#E2E8F0'}`, background: photoEtat === opt.v ? opt.bg : '#F8FAFC', color: photoEtat === opt.v ? opt.c : '#64748B', fontSize: 11.5, fontWeight: photoEtat === opt.v ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                            {opt.l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Observations</label>
                      <textarea value={photoObs} onChange={e => setPhotoObs(e.target.value)} rows={3}
                        placeholder="Actions requises, details..."
                        style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 12.5, color: '#0F172A', background: '#fff', resize: 'vertical', fontFamily: 'inherit', outline: 'none' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button onClick={() => { setPhotoModal(null); resetPhotoForm(); }} disabled={photoSubmitting}
                        style={{ padding: '8px 14px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', opacity: photoSubmitting ? 0.5 : 1, fontFamily: 'inherit' }}>
                        Annuler
                      </button>
                      <button onClick={() => handlePhotoSubmit(r.id)} disabled={photoSubmitting}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 18px', background: ORANGE, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: photoSubmitting ? 'wait' : 'pointer', opacity: photoSubmitting ? 0.8 : 1, fontFamily: 'inherit' }}>
                        {photoSubmitting
                          ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Analyse IA en cours…</>
                          : <><Sparkles size={13} /> Envoyer &amp; analyser</>}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function Pulse({ value }: { value: number }) {
  const r = 34, c = 2 * Math.PI * r;
  const col = value >= 75 ? '#16A34A' : value >= 50 ? '#F59E0B' : '#DC2626';
  return (
    <svg width={88} height={88} viewBox="0 0 88 88" style={{ flexShrink: 0 }}>
      <circle cx={44} cy={44} r={r} fill="none" stroke="#F1F5F9" strokeWidth={9} />
      <circle cx={44} cy={44} r={r} fill="none" stroke={col} strokeWidth={9} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} transform="rotate(-90 44 44)" />
      <text x={44} y={48} textAnchor="middle" fontSize={22} fontWeight={800} fill={INK}>{value}</text>
    </svg>
  );
}

function PulseDot({ v }: { v: number }) {
  const col = v >= 75 ? '#16A34A' : v >= 50 ? '#F59E0B' : '#DC2626';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...num }}>
      <span style={{ width: 8, height: 8, borderRadius: 99, background: col }} />
      <span style={{ fontWeight: 700, color: col }}>{v}</span>
    </span>
  );
}

function labelPulse(v: number) {
  return v >= 80 ? 'Très productif' : v >= 60 ? 'Productif' : v >= 45 ? 'Moyen' : 'Distrait';
}

function Kpi({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div style={{ ...card, borderLeft: `4px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: MUT, fontSize: 11.5, fontWeight: 600 }}>{icon}{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color, marginTop: 4, ...num, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODULE HEURES SUPPLÉMENTAIRES
// ══════════════════════════════════════════════════════════════════════════════

interface HeureSuppSectionProps {
  detections: ReturnType<typeof detecterHeuresSup>;
  justificatifs: JustificatifHS[];
  onAjouter: (j: Omit<JustificatifHS, 'id'>) => void;
  onApprouver: (id: string, approbateur: string) => void;
  onSupprimer: (id: string) => void;
}

interface HSFormState {
  collaborateur: string; mle: string; fonction: string; projet: string;
  date: string; heuresOrdMin: number; heuresSupMin: number;
  motif: string; typeHS: TypeHS; odmRef: string;
}

const EMPTY_FORM: HSFormState = {
  collaborateur: '', mle: '', fonction: '', projet: '', date: new Date().toISOString().slice(0, 10),
  heuresOrdMin: 480, heuresSupMin: 60, motif: '', typeHS: 'TERRAIN', odmRef: '',
};

function HeureSuppSection({ detections, justificatifs, onAjouter, onApprouver, onSupprimer }: HeureSuppSectionProps) {
  const [open, setOpen] = useState(true);
  const [modal, setModal] = useState<'new' | 'print' | null>(null);
  const [printTarget, setPrintTarget] = useState<JustificatifHS | null>(null);
  const [form, setForm] = useState<HSFormState>({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Partial<HSFormState>>({});

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12,
    border: '1px solid #CBD5E1', borderRadius: 7, color: INK, background: '#fff', outline: 'none',
  };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: MUT, display: 'block', marginBottom: 3 };

  const upd = <K extends keyof HSFormState>(k: K, v: HSFormState[K]) => setForm(p => ({ ...p, [k]: v }));

  const validate = () => {
    const e: Partial<HSFormState> = {};
    if (!form.collaborateur.trim()) e.collaborateur = 'Requis';
    if (!form.projet.trim()) e.projet = 'Requis';
    if (!form.motif.trim()) e.motif = 'Requis';
    if (form.heuresSupMin <= 0) e.heuresSupMin = '> 0' as unknown as number;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onAjouter({
      date: form.date, collaborateur: form.collaborateur, mle: form.mle || undefined,
      fonction: form.fonction, projet: form.projet,
      heuresOrdMin: form.heuresOrdMin, heuresSupMin: form.heuresSupMin,
      motif: form.motif, typeHS: form.typeHS, odmRef: form.odmRef || undefined,
      approuve: false,
    });
    setModal(null);
    setForm({ ...EMPTY_FORM });
  };

  const prefillFromDetection = (d: ReturnType<typeof detecterHeuresSup>[0]) => {
    setForm({
      ...EMPTY_FORM,
      collaborateur: d.collab, fonction: d.fonction, projet: d.projets[0] ?? '',
      date: d.date, heuresOrdMin: SEUIL_JOURNALIER_MIN, heuresSupMin: d.supMin,
    });
    setModal('new');
  };

  const openPrint = (j: JustificatifHS) => { setPrintTarget(j); setModal('print'); };

  const totalSupMin = justificatifs.reduce((s, j) => s + j.heuresSupMin, 0);
  const nbApprouves = justificatifs.filter(j => j.approuve).length;

  return (
    <div style={{ ...card, marginTop: 14, padding: 0 }}>
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(234,88,12,.12)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <AlertTriangle size={18} style={{ color: '#EA580C' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>Heures supplémentaires & justificatifs</div>
          <div style={{ fontSize: 11, color: MUT, marginTop: 1 }}>
            {detections.length > 0
              ? `${detections.length} dépassement(s) détecté(s) aujourd'hui · ${justificatifs.length} justificatif(s) · ${fmtDuree(totalSupMin)} HS total`
              : `${justificatifs.length} justificatif(s) enregistré(s) · ${fmtDuree(totalSupMin)} HS total`
            }
          </div>
        </div>
        {detections.length > 0 && (
          <span style={{ padding: '3px 10px', background: 'rgba(234,88,12,.15)', color: '#EA580C', borderRadius: 20, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
            {detections.length} alerte{detections.length > 1 ? 's' : ''}
          </span>
        )}
        {open ? <ChevronUp size={16} style={{ color: MUT, flexShrink: 0 }} /> : <ChevronDown size={16} style={{ color: MUT, flexShrink: 0 }} />}
      </button>

      {open && (
        <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Dépassements auto-détectés */}
          {detections.length > 0 && (
            <div style={{ background: 'rgba(234,88,12,.06)', border: '1px solid rgba(234,88,12,.2)', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#EA580C', marginBottom: 8 }}>
                Dépassements du seuil journalier ({fmtDuree(SEUIL_JOURNALIER_MIN)}) détectés automatiquement
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {detections.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 8, padding: '8px 12px', border: '1px solid rgba(234,88,12,.15)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.collab}</div>
                      <div style={{ fontSize: 11, color: MUT }}>{d.projets.join(', ')} · {d.date}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#EA580C', ...num }}>{fmtDuree(d.totalMin)}</div>
                      <div style={{ fontSize: 10.5, color: '#94A3B8', ...num }}>+ {fmtDuree(d.supMin)} HS</div>
                    </div>
                    <button
                      onClick={() => prefillFromDetection(d)}
                      style={{ padding: '6px 12px', background: '#EA580C', color: '#fff', border: 'none', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                    >
                      <FileText size={12} style={{ display: 'inline', marginRight: 4 }} />Justifier
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tableau des justificatifs */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>
              Justificatifs enregistrés
              {nbApprouves > 0 && <span style={{ marginLeft: 8, padding: '2px 8px', background: '#DCFCE7', color: '#15803D', borderRadius: 20, fontSize: 10.5, fontWeight: 700 }}>{nbApprouves} approuvé(s)</span>}
            </div>
            <button
              onClick={() => { setForm({ ...EMPTY_FORM }); setModal('new'); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: PURPLE, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              <Plus size={13} /> Nouveau justificatif
            </button>
          </div>

          {justificatifs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#94A3B8', fontSize: 12 }}>
              Aucun justificatif. Cliquez « Nouveau » ou « Justifier » sur un dépassement détecté.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: 9, border: '1px solid #EEF2F7' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
                    {['Date', 'Agent', 'Projet', 'H. Ord.', 'H. Sup.', 'Type', 'ODM', 'Statut', 'Actions'].map((h, i) => (
                      <th key={i} style={{ padding: '9px 12px', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap', fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {justificatifs.map(j => (
                    <tr key={j.id} style={{ borderTop: '1px solid #EEF2F7' }}>
                      <td style={{ padding: '9px 12px', ...num, whiteSpace: 'nowrap' }}>{j.date}</td>
                      <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700, color: INK }}>{j.collaborateur}</div>
                        {j.mle && <div style={{ fontSize: 10.5, color: MUT }}>{j.mle}</div>}
                      </td>
                      <td style={{ padding: '9px 12px', maxWidth: 180 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.projet}</div>
                        <div style={{ fontSize: 10.5, color: MUT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.motif}</div>
                      </td>
                      <td style={{ padding: '9px 12px', ...num, color: '#15803D', whiteSpace: 'nowrap' }}>{fmtDuree(j.heuresOrdMin)}</td>
                      <td style={{ padding: '9px 12px', ...num, fontWeight: 700, color: '#EA580C', whiteSpace: 'nowrap' }}>+{fmtDuree(j.heuresSupMin)}</td>
                      <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{ padding: '2px 8px', background: 'rgba(234,88,12,.1)', color: '#EA580C', borderRadius: 20, fontSize: 10.5, fontWeight: 600 }}>
                          {TYPE_HS_LABELS[j.typeHS]}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', color: j.odmRef ? '#1D4ED8' : '#94A3B8', whiteSpace: 'nowrap', fontSize: 11 }}>
                        {j.odmRef || '—'}
                      </td>
                      <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                        {j.approuve ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: '#DCFCE7', color: '#15803D', borderRadius: 20, fontSize: 10.5, fontWeight: 700 }}>
                            <Check size={10} /> Approuvé
                          </span>
                        ) : (
                          <span style={{ padding: '2px 8px', background: '#FEF9C3', color: '#92400E', borderRadius: 20, fontSize: 10.5, fontWeight: 700 }}>
                            En attente
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button title="Imprimer justificatif" onClick={() => openPrint(j)} style={{ padding: '4px 8px', background: '#F1F5F9', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#475569' }}>
                            <Printer size={12} />
                          </button>
                          {!j.approuve && (
                            <button title="Approuver" onClick={() => onApprouver(j.id, 'Direction Principale')} style={{ padding: '4px 8px', background: '#DCFCE7', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#15803D' }}>
                              <Check size={12} />
                            </button>
                          )}
                          <button title="Supprimer" onClick={() => onSupprimer(j.id)} style={{ padding: '4px 8px', background: '#FEE2E2', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#DC2626' }}>
                            <X size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Modal Nouveau justificatif ── */}
      {modal === 'new' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(234,88,12,.12)', display: 'grid', placeItems: 'center' }}>
                <AlertTriangle size={18} style={{ color: '#EA580C' }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>Justificatif heures supplémentaires</div>
                <div style={{ fontSize: 11, color: MUT }}>SENELEC — Direction Principale Équipement</div>
              </div>
              <button onClick={() => setModal(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: MUT }}><X size={18} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Agent / Collaborateur *</label>
                <input style={{ ...inp, borderColor: errors.collaborateur ? '#DC2626' : '#CBD5E1' }} value={form.collaborateur} onChange={e => upd('collaborateur', e.target.value)} placeholder="Prénom NOM" />
                {errors.collaborateur && <div style={{ fontSize: 10.5, color: '#DC2626', marginTop: 2 }}>{errors.collaborateur}</div>}
              </div>
              <div>
                <label style={lbl}>Matricule (Mle)</label>
                <input style={inp} value={form.mle} onChange={e => upd('mle', e.target.value)} placeholder="C00768" />
              </div>
              <div>
                <label style={lbl}>Fonction</label>
                <input style={inp} value={form.fonction} onChange={e => upd('fonction', e.target.value)} placeholder="Ingénieur Projets" />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Projet *</label>
                <input style={{ ...inp, borderColor: errors.projet ? '#DC2626' : '#CBD5E1' }} value={form.projet} onChange={e => upd('projet', e.target.value)} placeholder="PADERAU, PASE2, BEST…" />
                {errors.projet && <div style={{ fontSize: 10.5, color: '#DC2626', marginTop: 2 }}>{errors.projet}</div>}
              </div>
              <div>
                <label style={lbl}>Date</label>
                <input style={inp} type="date" value={form.date} onChange={e => upd('date', e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Type d'heures supplémentaires</label>
                <select style={inp} value={form.typeHS} onChange={e => upd('typeHS', e.target.value as TypeHS)}>
                  {Object.entries(TYPE_HS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Heures ordinaires (min)</label>
                <input style={inp} type="number" min={0} value={form.heuresOrdMin} onChange={e => upd('heuresOrdMin', Number(e.target.value))} />
                <div style={{ fontSize: 10, color: MUT, marginTop: 2 }}>{fmtDuree(form.heuresOrdMin)} standard</div>
              </div>
              <div>
                <label style={lbl}>Heures supplémentaires (min) *</label>
                <input style={{ ...inp, borderColor: errors.heuresSupMin ? '#DC2626' : '#CBD5E1' }} type="number" min={1} value={form.heuresSupMin} onChange={e => upd('heuresSupMin', Number(e.target.value))} />
                <div style={{ fontSize: 10, color: '#EA580C', marginTop: 2, fontWeight: 600 }}>+{fmtDuree(form.heuresSupMin)} supplémentaires</div>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Référence ODM (si mission terrain)</label>
                <input style={inp} value={form.odmRef} onChange={e => upd('odmRef', e.target.value)} placeholder="ODM N°3 - 2026, ODM-009…" />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Motif justificatif *</label>
                <textarea
                  style={{ ...inp, minHeight: 72, resize: 'vertical' }}
                  value={form.motif} onChange={e => upd('motif', e.target.value)}
                  placeholder="Décrivez la raison des heures supplémentaires…"
                />
                {errors.motif && <div style={{ fontSize: 10.5, color: '#DC2626', marginTop: 2 }}>{errors.motif}</div>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
              <button onClick={() => setModal(null)} style={{ padding: '8px 16px', background: '#F1F5F9', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', color: '#475569' }}>Annuler</button>
              <button onClick={handleSubmit} style={{ padding: '8px 18px', background: PURPLE, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                <Check size={13} style={{ display: 'inline', marginRight: 6 }} />Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Impression ── */}
      {modal === 'print' && printTarget && (
        <PrintJustificatifModal justificatif={printTarget} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

// ── Print justification modal ────────────────────────────────────────────────

function PrintJustificatifModal({ justificatif: j, onClose }: { justificatif: JustificatifHS; onClose: () => void }) {
  const printDoc = () => {
    const html = buildPrintHTML(j);
    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 600 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <Printer size={20} style={{ color: PURPLE }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>Aperçu justificatif heures supplémentaires</div>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: MUT }}><X size={18} /></button>
        </div>

        {/* Preview card */}
        <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: 18, fontSize: 12, lineHeight: 1.7, background: '#FAFAFA' }}>
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: PURPLE }}>SENELEC — Direction Principale Équipement</div>
            <div style={{ fontSize: 11, color: MUT }}>Direction des Projets et du Développement</div>
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 8, padding: '4px 0', borderTop: '2px solid #E2E8F0', borderBottom: '2px solid #E2E8F0' }}>
              JUSTIFICATIF D'HEURES SUPPLÉMENTAIRES
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px' }}>
            <div><span style={{ color: MUT }}>Agent : </span><strong>{j.collaborateur}</strong></div>
            {j.mle && <div><span style={{ color: MUT }}>Matricule : </span><strong>{j.mle}</strong></div>}
            <div><span style={{ color: MUT }}>Fonction : </span>{j.fonction || '—'}</div>
            <div><span style={{ color: MUT }}>Date : </span><strong>{j.date}</strong></div>
            <div style={{ gridColumn: '1/-1' }}><span style={{ color: MUT }}>Projet : </span><strong>{j.projet}</strong></div>
            <div><span style={{ color: MUT }}>H. ordinaires : </span><strong style={{ color: '#15803D' }}>{fmtDuree(j.heuresOrdMin)}</strong></div>
            <div><span style={{ color: MUT }}>H. supplémentaires : </span><strong style={{ color: '#EA580C' }}>+{fmtDuree(j.heuresSupMin)}</strong></div>
            <div><span style={{ color: MUT }}>Type : </span>{TYPE_HS_LABELS[j.typeHS]}</div>
            {j.odmRef && <div><span style={{ color: MUT }}>ODM : </span><strong style={{ color: '#1D4ED8' }}>{j.odmRef}</strong></div>}
            <div style={{ gridColumn: '1/-1', marginTop: 6 }}><span style={{ color: MUT }}>Motif : </span>{j.motif}</div>
          </div>
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, fontSize: 11, color: MUT }}>
            <div style={{ borderTop: '1px solid #CBD5E1', paddingTop: 8 }}>Agent<br /><br /><br />Signature :</div>
            <div style={{ borderTop: '1px solid #CBD5E1', paddingTop: 8 }}>
              {j.approuve ? `Approuvé par : ${j.approbateurNom ?? '—'}` : 'Chef de projet / Directeur'}<br />
              {j.dateApprobation && `Date : ${j.dateApprobation}`}<br /><br />Signature :
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: '#F1F5F9', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', color: '#475569' }}>Fermer</button>
          <button onClick={printDoc} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 18px', background: PURPLE, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
            <Printer size={14} /> Imprimer / PDF
          </button>
        </div>
      </div>
    </div>
  );
}

function buildPrintHTML(j: JustificatifHS): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Justificatif HS — ${j.collaborateur} — ${j.date}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Arial', sans-serif; font-size: 12pt; color: #0F172A; padding: 30mm 25mm; }
    .header { text-align: center; border-bottom: 2px solid #3D1A6B; padding-bottom: 12px; margin-bottom: 20px; }
    .org { font-size: 16pt; font-weight: 800; color: #3D1A6B; }
    .sub  { font-size: 10pt; color: #64748B; margin-top: 2px; }
    .title { font-size: 14pt; font-weight: 700; margin: 14px 0; text-transform: uppercase; letter-spacing: 1px; }
    .grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 30px; margin: 14px 0; }
    .field { font-size: 11pt; }
    .label { color: #64748B; }
    .value { font-weight: 700; }
    .full  { grid-column: 1/-1; }
    .hs-val { color: #EA580C; }
    .ord-val { color: #15803D; }
    .motif-box { border: 1px solid #CBD5E1; border-radius: 6px; padding: 10px; margin: 10px 0; font-size: 11pt; line-height: 1.6; }
    .sigs { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 40px; }
    .sig-block { border-top: 1px solid #94A3B8; padding-top: 8px; font-size: 10pt; color: #64748B; min-height: 70px; }
    .odm-tag { display: inline-block; background: #DBEAFE; color: #1D4ED8; padding: 2px 8px; border-radius: 4px; font-size: 10pt; font-weight: 700; }
    @media print { body { padding: 15mm 20mm; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="org">SENELEC — Direction Principale Équipement</div>
    <div class="sub">Direction des Projets et du Développement (DPD)</div>
  </div>
  <div class="title" style="text-align:center;">Justificatif d'heures supplémentaires</div>
  <div class="grid">
    <div class="field full"><span class="label">Agent : </span><span class="value">${j.collaborateur}</span>${j.mle ? ` &nbsp;·&nbsp; <span class="label">Mle : </span><span class="value">${j.mle}</span>` : ''}</div>
    <div class="field"><span class="label">Fonction : </span>${j.fonction || '—'}</div>
    <div class="field"><span class="label">Date : </span><span class="value">${j.date}</span></div>
    <div class="field full"><span class="label">Projet : </span><span class="value">${j.projet}</span></div>
    <div class="field"><span class="label">Heures ordinaires : </span><span class="value ord-val">${fmtDuree(j.heuresOrdMin)}</span></div>
    <div class="field"><span class="label">Heures supplémentaires : </span><span class="value hs-val">+ ${fmtDuree(j.heuresSupMin)}</span></div>
    <div class="field"><span class="label">Type : </span>${TYPE_HS_LABELS[j.typeHS]}</div>
    ${j.odmRef ? `<div class="field"><span class="label">Référence ODM : </span><span class="odm-tag">${j.odmRef}</span></div>` : '<div></div>'}
  </div>
  <div style="margin:10px 0 4px;font-weight:700;color:#475569;font-size:11pt;">Motif :</div>
  <div class="motif-box">${j.motif}</div>
  ${j.approuve ? `<div style="background:#DCFCE7;border:1px solid #86EFAC;border-radius:6px;padding:8px 12px;margin:10px 0;font-size:10.5pt;">
    ✓ Approuvé par <strong>${j.approbateurNom ?? '—'}</strong>${j.dateApprobation ? ` le ${j.dateApprobation}` : ''}
  </div>` : ''}
  <div class="sigs">
    <div class="sig-block">
      L'agent<br/><br/><br/>
      Signature &amp; date :
    </div>
    <div class="sig-block">
      ${j.approuve ? `Approuvé par : ${j.approbateurNom ?? '—'}` : 'Chef de Projet / Directeur'}<br/><br/><br/>
      Signature &amp; date :
    </div>
  </div>
</body>
</html>`;
}
