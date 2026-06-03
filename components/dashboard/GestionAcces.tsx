'use client';
/**
 * GestionAcces.tsx — Habilitations configurables (rôles × modules)
 * ----------------------------------------------------------------
 * Permet à l'administrateur d'ATTRIBUER/RETIRER dynamiquement les modules
 * (sections) à chaque rôle. Les changements sont persistés et appliqués
 * immédiatement (via `permissionStore` → `authStore.canAccessSection`).
 */

import React from 'react';
import { ShieldCheck, RotateCcw, Check } from 'lucide-react';
import { ROLES, ROLE_SECTIONS, type RoleCode, type SidebarSectionId } from '@/lib/authStore';
import { usePermissionStore } from '@/lib/permissionStore';

const SECTIONS: { id: SidebarSectionId; label: string }[] = [
  { id: 'accueil',      label: 'Accueil' },
  { id: 'portefeuille', label: 'Portefeuille' },
  { id: 'mes_projets',  label: 'Mes projets' },
  { id: 'execution',    label: 'Exécution & Contrôle' },
  { id: 'finances',     label: 'Finances' },
  { id: 'logistique',   label: 'Logistique' },
  { id: 'transverses',  label: 'Pilotage & BI' },
  { id: 'parametrage',  label: 'Paramétrage' },
];

const ROLE_ORDER: RoleCode[] = [
  'DIR_DPE', 'PMO', 'CHEF_DEPT', 'CHEF_PROJ', 'INGENIEUR', 'EXPERT', 'CONTROLEUR',
  'CHARGE', 'CTRL_FIN', 'RESP_LOG', 'ASSISTANT', 'SECRETAIRE', 'CHAUFFEUR', 'ADMIN',
];

export default function GestionAcces() {
  const { sectionOverrides, setRoleSections, resetRole, resetAll, overrideFor } = usePermissionStore();

  const effective = (role: RoleCode): string[] => overrideFor(role) ?? ROLE_SECTIONS[role];

  const toggle = (role: RoleCode, section: SidebarSectionId) => {
    const cur = effective(role);
    const next = cur.includes(section) ? cur.filter(s => s !== section) : [...cur, section];
    setRoleSections(role, next);
  };

  return (
    <div style={{ padding: 20, maxWidth: 1180, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EEF2FF', display: 'grid', placeItems: 'center' }}>
          <ShieldCheck size={22} style={{ color: '#4338CA' }} />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0 }}>Habilitations par rôle</h1>
          <p style={{ fontSize: 13, color: '#64748B', margin: '2px 0 0' }}>
            Attribuez les modules à chaque rôle. Les modifications sont appliquées immédiatement.
          </p>
        </div>
        <button onClick={resetAll} style={btnGhost}><RotateCcw size={14} /> Tout réinitialiser</button>
      </div>

      <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, marginTop: 14 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              <th style={{ ...th, textAlign: 'left', position: 'sticky', left: 0, background: '#F8FAFC' }}>Rôle</th>
              {SECTIONS.map(s => <th key={s.id} style={th}>{s.label}</th>)}
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {ROLE_ORDER.map(role => {
              const eff = effective(role);
              const customized = !!sectionOverrides[role];
              const isAdmin = role === 'ADMIN';
              return (
                <tr key={role} style={{ borderTop: '1px solid #EEF2F7' }}>
                  <td style={{ padding: '9px 12px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', position: 'sticky', left: 0, background: '#fff' }}>
                    <span style={{ marginRight: 6 }}>{ROLES[role].icon}</span>{ROLES[role].label}
                    {customized && <span style={{ marginLeft: 6, fontSize: 9, color: '#B45309', fontWeight: 700 }}>(modifié)</span>}
                  </td>
                  {SECTIONS.map(s => {
                    const on = eff.includes(s.id);
                    return (
                      <td key={s.id} style={{ padding: '6px 8px', textAlign: 'center' }}>
                        <button
                          onClick={() => !isAdmin && toggle(role, s.id)}
                          disabled={isAdmin}
                          title={isAdmin ? 'ADMIN a tous les accès' : (on ? 'Retirer' : 'Attribuer')}
                          style={{
                            width: 26, height: 26, borderRadius: 6, cursor: isAdmin ? 'not-allowed' : 'pointer',
                            border: `1px solid ${on ? '#16A34A' : '#CBD5E1'}`,
                            background: on ? '#16A34A' : '#fff', display: 'inline-grid', placeItems: 'center',
                            opacity: isAdmin ? 0.6 : 1,
                          }}
                        >
                          {on && <Check size={14} style={{ color: '#fff' }} />}
                        </button>
                      </td>
                    );
                  })}
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                    {customized && !isAdmin && (
                      <button onClick={() => resetRole(role)} title="Réinitialiser ce rôle" style={iconBtn}>
                        <RotateCcw size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 10 }}>
        Astuce : le rôle ADMIN conserve tous les accès. Un rôle « (modifié) » utilise votre configuration ;
        sinon il suit la configuration par défaut (organigrammes DPE / ND 005/2023).
      </p>
    </div>
  );
}

const th: React.CSSProperties = { padding: '10px 8px', fontWeight: 700, color: '#475569', fontSize: 11, whiteSpace: 'nowrap' };
const btnGhost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9,
  background: '#fff', color: '#334155', border: '1px solid #CBD5E1', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
};
const iconBtn: React.CSSProperties = {
  display: 'inline-grid', placeItems: 'center', width: 26, height: 26, borderRadius: 6,
  background: '#F1F5F9', border: 'none', cursor: 'pointer', color: '#475569',
};
