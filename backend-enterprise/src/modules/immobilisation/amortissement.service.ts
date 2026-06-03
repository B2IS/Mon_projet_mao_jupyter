import { Injectable } from '@nestjs/common';

/** Amortissement linéaire (PCG/SYSCOHADA). */
@Injectable()
export class AmortissementService {
  plan(valeur: number, duree: number, dateMiseService?: Date) {
    if (duree <= 0) return [];
    const annuite = Math.round(valeur / duree);
    const startYear = (dateMiseService ?? new Date()).getFullYear();
    let vnc = valeur;
    return Array.from({ length: duree }, (_, i) => {
      const dot = i === duree - 1 ? vnc : annuite; // solde la dernière année
      vnc = Math.max(0, vnc - dot);
      return { annee: startYear + i, dotation: dot, vnc };
    });
  }
}
