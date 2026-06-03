/** Roster d'agents IA — chacun lié à un périmètre organisationnel (orgPath). */
export interface AgentDef { key: string; label: string; orgCode: string; consolidated?: boolean; }

export const AGENTS: AgentDef[] = [
  { key: 'dg',             label: 'DG Agent',             orgCode: 'DPE', consolidated: true },
  { key: 'pmo',            label: 'PMO Agent',            orgCode: 'CSE', consolidated: true },
  { key: 'dep',            label: 'DEP Agent',            orgCode: 'DEP' },
  { key: 'dpt',            label: 'DPT Agent',            orgCode: 'DPT' },
  { key: 'dpd',            label: 'DPD Agent',            orgCode: 'DPD' },
  { key: 'dgc',            label: 'DGC Agent',            orgCode: 'DGC' },
  { key: 'dit',            label: 'DIT Agent',            orgCode: 'DIT' },
  { key: 'sig',            label: 'SIG Agent',            orgCode: 'SIG' },
  { key: 'immobilisation', label: 'Immobilisation Agent', orgCode: 'IMMO' },
  { key: 'finance',        label: 'Finance Agent',        orgCode: 'CAB' },
  { key: 'marches',        label: 'Marchés Agent',        orgCode: 'CAB' },
  { key: 'uagl',           label: 'UAGL Agent',           orgCode: 'UAGL' },
];
