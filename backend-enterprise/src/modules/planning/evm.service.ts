import { Injectable } from '@nestjs/common';

export interface TacheEVM { coutPrevu: number; coutReel: number; avancement: number; }
export interface EVMResult {
  pv: number; ev: number; ac: number; bac: number;
  cv: number; sv: number; cpi: number; spi: number;
  eac: number; etc: number; vac: number;
}

/**
 * EvmService — Earned Value Management (PMBOK 7).
 * PV (BCWS) = Σ coutPrevu ; EV (BCWP) = Σ coutPrevu·avancement ; AC (ACWP) = Σ coutReel.
 * CPI = EV/AC ; SPI = EV/PV ; EAC = BAC/CPI ; ETC = EAC−AC ; VAC = BAC−EAC.
 */
@Injectable()
export class EvmService {
  compute(taches: TacheEVM[]): EVMResult {
    const bac = taches.reduce((s, t) => s + t.coutPrevu, 0);
    const pv = bac; // à date de référence ; affinable par % planifié
    const ev = taches.reduce((s, t) => s + t.coutPrevu * (t.avancement / 100), 0);
    const ac = taches.reduce((s, t) => s + t.coutReel, 0);
    const cpi = ac > 0 ? ev / ac : 1;
    const spi = pv > 0 ? ev / pv : 1;
    const eac = cpi > 0 ? bac / cpi : bac;
    return {
      pv: r(pv), ev: r(ev), ac: r(ac), bac: r(bac),
      cv: r(ev - ac), sv: r(ev - pv),
      cpi: +cpi.toFixed(2), spi: +spi.toFixed(2),
      eac: r(eac), etc: r(eac - ac), vac: r(bac - eac),
    };
  }
}
const r = (n: number) => Math.round(n);
