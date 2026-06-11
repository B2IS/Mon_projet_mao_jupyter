"""
services.py — Moteur d'amortissement (miroir de lib/immobilisations/amortissement.ts).
Plan linéaire prorata temporis SYSCOHADA : 1re clôture au 31/12 de l'année de mise
en service au prorata des jours, exercices pleins ensuite, dernier exercice = solde.
"""
from datetime import date, timedelta
from decimal import Decimal


def plan_lineaire(valeur_brute, date_mes: date, duree_annees: int, valeur_residuelle=0):
    base = max(0.0, float(valeur_brute) - float(valeur_residuelle))
    duree = max(1, int(duree_annees))
    if base == 0 or not date_mes:
        return []
    fin = date_mes + timedelta(days=duree * 365)
    taux_jour = base / (duree * 365)
    vb = float(valeur_brute)
    lignes, curseur, cumul = [], date_mes, 0.0
    while curseur < fin and cumul < base - 0.5:
        fin_ex = date(curseur.year, 12, 31)
        borne = min(fin_ex, fin)
        jours = (borne - curseur).days + (0 if borne == fin else 1)
        dotation = taux_jour * jours
        if cumul + dotation > base:
            dotation = base - cumul
        base_debut = vb - cumul
        cumul += dotation
        lignes.append({
            'exercice': borne.year, 'date': borne.isoformat(), 'base': round(base_debut, 2),
            'jours': jours, 'dotation': round(dotation, 2), 'cumul': round(cumul, 2),
            'vnc': round(vb - cumul, 2),
        })
        curseur = borne + timedelta(days=1)
    return lignes


def plan_degressif(valeur_brute, date_mes: date, duree_annees: int, valeur_residuelle=0):
    duree = max(1, int(duree_annees))
    coef = 1.5 if duree <= 4 else 2.0 if duree <= 6 else 2.5
    taux = (1 / duree) * coef
    vb, vr = float(valeur_brute), float(valeur_residuelle)
    vnc, cumul, lignes = vb, 0.0, []
    for i in range(duree):
        restant = duree - i
        dot = max((vnc - vr) * taux, (vnc - vr) / restant)
        if i == duree - 1:
            dot = vnc - vr
        annee = date_mes.year + i
        base_debut = vnc
        cumul += dot
        vnc -= dot
        lignes.append({
            'exercice': annee, 'date': f'{annee}-12-31', 'base': round(base_debut, 2),
            'jours': 365, 'dotation': round(dot, 2), 'cumul': round(cumul, 2), 'vnc': round(vnc, 2),
        })
    return lignes


def plan_amort(valeur_brute, pv):
    fn = plan_degressif if pv.methode == 'degressif' else plan_lineaire
    return fn(valeur_brute, pv.date_reception_provisoire, pv.duree_amort, pv.valeur_residuelle)


def plan_consolide(actif, pv):
    """Plan consolidé de l'actif (somme des plans articles agrégée par exercice)."""
    par_exo = {}
    for ligne in actif.lignes.filter(est_groupe=False):
        if ligne.valeur <= 0:
            continue
        for e in plan_amort(ligne.valeur, pv):
            par_exo.setdefault(e['exercice'], 0.0)
            par_exo[e['exercice']] += e['dotation']
    vb = float(actif.valeur_brute)
    out, cumul = [], 0.0
    for exo in sorted(par_exo):
        dot = par_exo[exo]
        base = vb - cumul
        cumul += dot
        out.append({'exercice': exo, 'date': f'{exo}-12-31', 'base': round(base, 2),
                    'dotation': round(dot, 2), 'cumul': round(cumul, 2), 'vnc': round(vb - cumul, 2)})
    return out
