/**
 * DynamicForm.tsx — Formulaire configurable dynamiquement
 * Permet : ajout de champs, sections dynamiques, champs conditionnels,
 * validation configurable, sans développement.
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { Plus, X, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'radio' | 'file' | 'currency' | 'email' | 'url';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  section?: string;
  required?: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
  condition?: { field: string; value: string }; // champ conditionnel
  helpText?: string;
  defaultValue?: any;
  order?: number;
}

export interface FormSection {
  id: string;
  label: string;
  order: number;
  collapsed?: boolean;
}

export interface DynamicFormProps {
  fields: FieldDef[];
  sections?: FormSection[];
  initialData?: Record<string, any>;
  onSubmit: (data: Record<string, any>) => void;
  onCancel?: () => void;
  readOnly?: boolean;
  allowConfigure?: boolean; // permet à l'utilisateur d'ajouter des champs
}

export default function DynamicForm({
  fields: baseFields,
  sections: baseSections,
  initialData = {},
  onSubmit,
  onCancel,
  readOnly = false,
  allowConfigure = false,
}: DynamicFormProps) {
  const [data, setData] = useState<Record<string, any>>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fields, setFields] = useState<FieldDef[]>(baseFields);
  const [sections, setSections] = useState<FormSection[] | undefined>(baseSections);
  const [showConfig, setShowConfig] = useState(false);
  const [newField, setNewField] = useState<Partial<FieldDef>>({ type: 'text', label: '' });

  const grouped = useMemo(() => {
    const map: Record<string, FieldDef[]> = {};
    fields.forEach(f => {
      const sec = f.section || '_default';
      if (!map[sec]) map[sec] = [];
      map[sec].push(f);
    });
    Object.values(map).forEach(arr => arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    return map;
  }, [fields]);

  const isVisible = useCallback((f: FieldDef): boolean => {
    if (!f.condition) return true;
    return data[f.condition.field] === f.condition.value;
  }, [data]);

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    fields.forEach(f => {
      if (f.required && isVisible(f)) {
        const v = data[f.key];
        if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) {
          errs[f.key] = 'Ce champ est obligatoire';
        }
      }
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [fields, data, isVisible]);

  const handleSubmit = useCallback(() => {
    if (validate()) {
      onSubmit(data);
    }
  }, [data, validate, onSubmit]);

  const updateValue = useCallback((key: string, value: any) => {
    setData(prev => ({ ...prev, [key]: value }));
    setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  }, []);

  const addField = useCallback(() => {
    if (!newField.label || !newField.key) return;
    const field: FieldDef = {
      key: newField.key,
      label: newField.label,
      type: newField.type || 'text',
      section: newField.section || '_default',
      required: false,
      order: fields.length,
    };
    setFields(prev => [...prev, field]);
    setNewField({ type: 'text', label: '' });
  }, [newField, fields.length]);

  const toggleSection = useCallback((id: string) => {
    setSections(prev => prev?.map(s => s.id === id ? { ...s, collapsed: !s.collapsed } : s));
  }, []);

  const renderField = (f: FieldDef) => {
    if (!isVisible(f)) return null;
    const val = data[f.key];
    const err = errors[f.key];
    return (
      <div key={f.key} className="form-group" style={{ marginBottom: 12 }}>
        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {f.label}
          {f.required && <span style={{ color: 'var(--danger)' }}>*</span>}
        </label>
        {renderInput(f, val, readOnly, (v: any) => updateValue(f.key, v))}
        {f.helpText && <span className="form-hint">{f.helpText}</span>}
        {err && <span className="form-error">{err}</span>}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {allowConfigure && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowConfig(v => !v)}>
            <SettingsIcon /> Configurer
          </button>
        </div>
      )}

      {showConfig && allowConfigure && (
        <div className="card" style={{ padding: 12, background: 'var(--bg-stripe)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Ajouter un champ personnalisé</div>
          <div className="form-row">
            <input className="form-input" placeholder="Clé (ex: code_projet)" value={newField.key || ''} onChange={e => setNewField(f => ({ ...f, key: e.target.value }))} />
            <input className="form-input" placeholder="Label (ex: Code Projet)" value={newField.label || ''} onChange={e => setNewField(f => ({ ...f, label: e.target.value }))} />
            <select className="form-select" value={newField.type || 'text'} onChange={e => setNewField(f => ({ ...f, type: e.target.value as FieldType }))}>
              <option value="text">Texte</option>
              <option value="textarea">Texte long</option>
              <option value="number">Nombre</option>
              <option value="date">Date</option>
              <option value="select">Liste déroulante</option>
              <option value="checkbox">Case à cocher</option>
              <option value="currency">Montant (FCFA)</option>
              <option value="email">Email</option>
              <option value="url">URL</option>
            </select>
          </div>
          <button className="btn btn-primary btn-sm" onClick={addField} style={{ marginTop: 8 }}>
            <Plus size={12} /> Ajouter le champ
          </button>
        </div>
      )}

      {sections && sections.length > 0 ? (
        sections.sort((a, b) => a.order - b.order).map(sec => (
          <div key={sec.id} className="card">
            <div
              className="card-header"
              onClick={() => toggleSection(sec.id)}
              style={{ cursor: 'pointer', userSelect: 'none' }}
            >
              <span className="card-title">{sec.label}</span>
              {sec.collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </div>
            {!sec.collapsed && (
              <div className="card-body">
                {grouped[sec.id]?.map(renderField)}
              </div>
            )}
          </div>
        ))
      ) : (
        <div className="card">
          <div className="card-body">
            {grouped['_default']?.map(renderField)}
          </div>
        </div>
      )}

      {!readOnly && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {onCancel && (
            <button className="btn btn-secondary" onClick={onCancel}>Annuler</button>
          )}
          <button className="btn btn-primary" onClick={handleSubmit}>Enregistrer</button>
        </div>
      )}
    </div>
  );
}

function renderInput(f: FieldDef, value: any, readOnly: boolean, onChange: (v: any) => void) {
  if (readOnly) {
    return <div className="form-input" style={{ background: 'var(--gray-50)', color: 'var(--text-muted)' }}>{value != null ? String(value) : '—'}</div>;
  }
  switch (f.type) {
    case 'textarea':
      return <textarea className="form-textarea" placeholder={f.placeholder} value={value ?? ''} onChange={e => onChange(e.target.value)} />;
    case 'select':
      return (
        <select className="form-select" value={value ?? ''} onChange={e => onChange(e.target.value)}>
          <option value="">— Sélectionner —</option>
          {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    case 'checkbox':
      return <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} />;
    case 'number':
    case 'currency':
      return <input className="form-input" type="number" placeholder={f.placeholder} value={value ?? ''} onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))} />;
    case 'date':
      return <input className="form-input" type="date" value={value ?? ''} onChange={e => onChange(e.target.value)} />;
    case 'email':
      return <input className="form-input" type="email" placeholder={f.placeholder} value={value ?? ''} onChange={e => onChange(e.target.value)} />;
    case 'url':
      return <input className="form-input" type="url" placeholder={f.placeholder} value={value ?? ''} onChange={e => onChange(e.target.value)} />;
    default:
      return <input className="form-input" type="text" placeholder={f.placeholder} value={value ?? ''} onChange={e => onChange(e.target.value)} />;
  }
}

function SettingsIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.67 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.67 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.67a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
