// ── Couche d'ingestion — sources de données brutes ────────────────────────────
// Simule les lectures depuis les capteurs IoT (MQTT/Modbus/HTTP)
// et le registre des flux caméras (RTSP/ONVIF).
// En production : remplacer les générateurs par les vraies connexions.

import { POP, SensorReading, Camera, POPEvent, EventSeverity, EventStatus } from '../entity/config_entity';
import { logger } from '../utils/logger';

// ── Référentiel des 42 POP ────────────────────────────────────────────────────

export const POPS: POP[] = [
  { id: 'pop-dakar',          name: 'POP Dakar',          region: 'Dakar',          lat: 14.6928, lng: -17.4467, status: 'normal',   cameras: 6, sensors: 12, address: 'Entrée principale, Dakar' },
  { id: 'pop-thies',          name: 'POP Thiès',           region: 'Thiès',          lat: 14.7880, lng: -16.9270, status: 'critical',  cameras: 3, sensors: 8,  address: 'Salle télécom, Thiès' },
  { id: 'pop-saint-louis',    name: 'POP Saint-Louis',    region: 'Saint-Louis',    lat: 16.0177, lng: -16.4897, status: 'normal',   cameras: 4, sensors: 10, address: 'Entrée principale, Saint-Louis' },
  { id: 'pop-kaolack',        name: 'POP Kaolack',        region: 'Kaolack',        lat: 14.1500, lng: -16.0700, status: 'critical',  cameras: 3, sensors: 7,  address: 'Salle énergie, Kaolack' },
  { id: 'pop-louga',          name: 'POP Louga',          region: 'Louga',          lat: 15.6200, lng: -16.2300, status: 'degraded',  cameras: 3, sensors: 6,  address: 'Groupe électrogène, Louga' },
  { id: 'pop-matam',          name: 'POP Matam',          region: 'Matam',          lat: 15.6600, lng: -13.2550, status: 'degraded',  cameras: 2, sensors: 5,  address: 'Réservoir carburant, Matam' },
  { id: 'pop-tambacounda',    name: 'POP Tambacounda',    region: 'Tambacounda',    lat: 13.7709, lng: -13.6670, status: 'normal',   cameras: 3, sensors: 8,  address: 'Entrée principale, Tambacounda' },
  { id: 'pop-ziguinchor',     name: 'POP Ziguinchor',     region: 'Ziguinchor',     lat: 12.5600, lng: -16.2700, status: 'normal',   cameras: 3, sensors: 7,  address: 'Salle télécom, Ziguinchor' },
  { id: 'pop-kolda',          name: 'POP Kolda',          region: 'Kolda',          lat: 12.8989, lng: -14.9412, status: 'normal',   cameras: 3, sensors: 6,  address: 'Salle énergie, Kolda' },
  { id: 'pop-podor',          name: 'POP Podor',          region: 'Saint-Louis',    lat: 16.6500, lng: -14.9600, status: 'normal',   cameras: 3, sensors: 5,  address: 'Entrée principale, Podor' },
  { id: 'pop-diourbel',       name: 'POP Diourbel',       region: 'Diourbel',       lat: 14.6558, lng: -16.2318, status: 'normal',   cameras: 3, sensors: 6,  address: 'Salle télécom, Diourbel' },
  { id: 'pop-fatick',         name: 'POP Fatick',         region: 'Fatick',         lat: 14.3392, lng: -16.4084, status: 'normal',   cameras: 3, sensors: 5,  address: 'Entrée principale, Fatick' },
  { id: 'pop-kaffrine',       name: 'POP Kaffrine',       region: 'Kaffrine',       lat: 14.1057, lng: -15.5506, status: 'normal',   cameras: 3, sensors: 5,  address: 'Entrée principale, Kaffrine' },
  { id: 'pop-guediawaye',     name: 'POP Guédiawaye',     region: 'Dakar',          lat: 14.7726, lng: -17.3886, status: 'normal',   cameras: 3, sensors: 6,  address: 'Salle énergie, Guédiawaye' },
  { id: 'pop-tivaouane',      name: 'POP Tivaouane',      region: 'Thiès',          lat: 14.9550, lng: -16.8130, status: 'normal',   cameras: 3, sensors: 5,  address: 'Entrée principale, Tivaouane' },
  { id: 'pop-mbour',          name: 'POP Mbour',          region: 'Thiès',          lat: 14.3700, lng: -16.9600, status: 'normal',   cameras: 3, sensors: 6,  address: 'Salle énergie, Mbour' },
  { id: 'pop-dagana',         name: 'POP Dagana',         region: 'Saint-Louis',    lat: 16.5167, lng: -15.5000, status: 'normal',   cameras: 2, sensors: 4,  address: 'Entrée principale, Dagana' },
  { id: 'pop-richard-toll',   name: 'POP Richard-Toll',   region: 'Saint-Louis',    lat: 16.4624, lng: -15.7017, status: 'normal',   cameras: 2, sensors: 4,  address: 'Entrée principale, Richard-Toll' },
  { id: 'pop-linguere',       name: 'POP Linguère',       region: 'Louga',          lat: 15.3897, lng: -15.1164, status: 'normal',   cameras: 2, sensors: 4,  address: 'Entrée principale, Linguère' },
  { id: 'pop-kebemer',        name: 'POP Kébémer',        region: 'Louga',          lat: 15.3700, lng: -16.4500, status: 'normal',   cameras: 2, sensors: 4,  address: 'Entrée principale, Kébémer' },
  { id: 'pop-rufisque',       name: 'POP Rufisque',       region: 'Dakar',          lat: 14.7167, lng: -17.2667, status: 'normal',   cameras: 3, sensors: 5,  address: 'Entrée principale, Rufisque' },
  { id: 'pop-pikine',         name: 'POP Pikine',         region: 'Dakar',          lat: 14.7548, lng: -17.3965, status: 'normal',   cameras: 3, sensors: 5,  address: 'Salle télécom, Pikine' },
  { id: 'pop-bargny',         name: 'POP Bargny',         region: 'Dakar',          lat: 14.6975, lng: -17.2244, status: 'normal',   cameras: 2, sensors: 4,  address: 'Entrée principale, Bargny' },
  { id: 'pop-joal',           name: 'POP Joal-Fadiouth',  region: 'Thiès',          lat: 14.1600, lng: -16.8500, status: 'normal',   cameras: 2, sensors: 4,  address: 'Entrée principale, Joal' },
  { id: 'pop-somone',         name: 'POP Saly-Somone',    region: 'Thiès',          lat: 14.4500, lng: -17.0200, status: 'normal',   cameras: 3, sensors: 5,  address: 'Entrée principale, Saly' },
  { id: 'pop-touba',          name: 'POP Touba',          region: 'Diourbel',       lat: 14.8508, lng: -15.8816, status: 'normal',   cameras: 4, sensors: 8,  address: 'Entrée principale, Touba' },
  { id: 'pop-mbacke',         name: 'POP Mbacké',         region: 'Diourbel',       lat: 14.7942, lng: -15.9113, status: 'normal',   cameras: 2, sensors: 4,  address: 'Entrée principale, Mbacké' },
  { id: 'pop-gossas',         name: 'POP Gossas',         region: 'Diourbel',       lat: 14.4800, lng: -16.0600, status: 'normal',   cameras: 2, sensors: 4,  address: 'Entrée principale, Gossas' },
  { id: 'pop-karang',         name: 'POP Karang',         region: 'Fatick',         lat: 13.5700, lng: -16.0800, status: 'normal',   cameras: 2, sensors: 3,  address: 'Entrée principale, Karang' },
  { id: 'pop-foundiougne',    name: 'POP Foundiougne',    region: 'Fatick',         lat: 14.1328, lng: -16.4681, status: 'normal',   cameras: 2, sensors: 4,  address: 'Entrée principale, Foundiougne' },
  { id: 'pop-sokone',         name: 'POP Sokone',         region: 'Fatick',         lat: 13.8900, lng: -16.3700, status: 'normal',   cameras: 2, sensors: 3,  address: 'Entrée principale, Sokone' },
  { id: 'pop-birkelane',      name: 'POP Birkelane',      region: 'Kaffrine',       lat: 14.0700, lng: -15.8900, status: 'normal',   cameras: 2, sensors: 3,  address: 'Entrée principale, Birkelane' },
  { id: 'pop-velingara',      name: 'POP Vélingara',      region: 'Kolda',          lat: 13.1500, lng: -14.1100, status: 'normal',   cameras: 2, sensors: 4,  address: 'Entrée principale, Vélingara' },
  { id: 'pop-sedhiou',        name: 'POP Sédhiou',        region: 'Sédhiou',        lat: 12.7068, lng: -15.5568, status: 'normal',   cameras: 2, sensors: 4,  address: 'Entrée principale, Sédhiou' },
  { id: 'pop-bignona',        name: 'POP Bignona',        region: 'Ziguinchor',     lat: 12.8100, lng: -16.2300, status: 'normal',   cameras: 2, sensors: 4,  address: 'Entrée principale, Bignona' },
  { id: 'pop-oussouye',       name: 'POP Oussouye',       region: 'Ziguinchor',     lat: 12.4867, lng: -16.5458, status: 'normal',   cameras: 2, sensors: 3,  address: 'Entrée principale, Oussouye' },
  { id: 'pop-kedougou',       name: 'POP Kédougou',       region: 'Kédougou',       lat: 12.5560, lng: -12.1810, status: 'normal',   cameras: 2, sensors: 4,  address: 'Entrée principale, Kédougou' },
  { id: 'pop-saraya',         name: 'POP Saraya',         region: 'Kédougou',       lat: 12.8356, lng: -11.7481, status: 'normal',   cameras: 2, sensors: 3,  address: 'Entrée principale, Saraya' },
  { id: 'pop-bakel',          name: 'POP Bakel',          region: 'Matam',          lat: 14.9000, lng: -12.4600, status: 'normal',   cameras: 2, sensors: 4,  address: 'Entrée principale, Bakel' },
  { id: 'pop-ranerou',        name: 'POP Ranérou',        region: 'Matam',          lat: 15.2900, lng: -13.9700, status: 'normal',   cameras: 2, sensors: 3,  address: 'Entrée principale, Ranérou' },
  { id: 'pop-goudiry',        name: 'POP Goudiry',        region: 'Tambacounda',    lat: 14.1800, lng: -12.7200, status: 'normal',   cameras: 2, sensors: 3,  address: 'Entrée principale, Goudiry' },
  { id: 'pop-koumpentoum',    name: 'POP Koumpentoum',    region: 'Tambacounda',    lat: 13.9878, lng: -14.5492, status: 'normal',   cameras: 2, sensors: 3,  address: 'Entrée principale, Koumpentoum' },
];

// ── Registre des caméras (108 flux RTSP/ONVIF) ────────────────────────────────

const ZONE_NAMES = ['Entrée principale', 'Salle télécom', 'Salle énergie', 'Parking', 'Couloir', 'Périmètre'];

export const CAMERAS_REGISTRY: Camera[] = POPS.flatMap(pop =>
  Array.from({ length: pop.cameras }, (_, i) => ({
    id: `${pop.id}-cam-${i + 1}`,
    popId: pop.id,
    popName: pop.name,
    name: ZONE_NAMES[i] ?? `Caméra ${i + 1}`,
    type: (i === 0 ? 'PTZ' : 'Fixe') as Camera['type'],
    status: (pop.status === 'critical' && i === 0 ? 'alert'
           : pop.status === 'degraded' && i === 1 ? 'offline'
           : 'live') as Camera['status'],
    rtspUrl: `rtsp://admin:password@192.168.${Math.floor(Math.random() * 255)}.${i + 1}:554/stream${i + 1}`,
    hlsUrl: `/mock/stream/${pop.id}/cam${i + 1}/index.m3u8`,
    resolution: '1080p',
    fps: 25,
    alertType: pop.status === 'critical' && i === 0
      ? (pop.id === 'pop-thies' ? 'INTRUSION' : 'FUMÉE')
      : pop.status === 'degraded' && i === 0
        ? (pop.id === 'pop-louga' ? 'PORTE OUVERTE' : 'GASOIL FAIBLE')
        : null,
  }))
);

// ── Lecture capteur (simulation — remplacer par MQTT/Modbus en prod) ──────────

export function fetchSensorReading(popId: string): SensorReading {
  logger.debug('Ingestion capteur', { popId });
  const baseTemp = 20 + Math.random() * 15;
  const baseHumidity = 40 + Math.random() * 40;
  return {
    popId,
    temperature: +(baseTemp + (Math.random() - 0.5) * 2).toFixed(1),
    humidity: +(baseHumidity + (Math.random() - 0.5) * 5).toFixed(1),
    fuelLevel: +(60 + Math.random() * 35).toFixed(1),
    fuelCapacity: 1000,
    fuelConsumption: +(20 + Math.random() * 8).toFixed(1),
    airQuality: (['Bonne', 'Modérée', 'Bonne'] as const)[Math.floor(Math.random() * 3)],
    smokeDetected: false,
    doorOpen: false,
    presence: false,
    powerSource: Math.random() > 0.1 ? 'Réseau + Groupe' : 'Groupe',
    timestamp: new Date().toISOString(),
  };
}

// ── Génération d'événements (simulation — remplacer par consommateur d'alertes) ─

const EVENT_TEMPLATES: Array<{ type: string; severity: EventSeverity; zone: string }> = [
  { type: 'Intrusion détectée',     severity: 'critical', zone: 'Entrée principale' },
  { type: 'Détection de fumée',     severity: 'critical', zone: 'Salle énergie' },
  { type: 'Température élevée',     severity: 'major',    zone: 'Salle télécom' },
  { type: 'Niveau gasoil faible',   severity: 'major',    zone: 'Groupe électrogène' },
  { type: 'Porte ouverte',          severity: 'minor',    zone: 'Entrée principale' },
  { type: 'Caméra hors ligne',      severity: 'minor',    zone: 'Caméra extérieure' },
  { type: 'Mouvement détecté',      severity: 'info',     zone: 'Parking' },
  { type: 'Vibrations anormales',   severity: 'info',     zone: 'Salle serveurs' },
  { type: "Qualité d'air dégradée", severity: 'info',     zone: 'Salle énergie' },
];

let _eventCounter = 1;

export function generateEvent(popId?: string): POPEvent {
  const pop = popId
    ? POPS.find(p => p.id === popId) ?? POPS[0]
    : POPS[Math.floor(Math.random() * POPS.length)];

  const tpl = EVENT_TEMPLATES[Math.floor(Math.random() * EVENT_TEMPLATES.length)];
  const now = new Date();
  now.setMinutes(now.getMinutes() - Math.floor(Math.random() * 60));

  const statuses: EventStatus[] = ['new', 'in_progress', 'resolved'];

  return {
    id: `evt-${Date.now()}-${_eventCounter++}`,
    time: now.toTimeString().slice(0, 5),
    popId: pop.id,
    popName: pop.name,
    type: tpl.type,
    zone: tpl.zone,
    severity: tpl.severity,
    status: statuses[Math.floor(Math.random() * statuses.length)],
    description: `${tpl.type} détecté(e) à ${pop.name} — ${tpl.zone}`,
    cameraId: `cam-${Math.floor(Math.random() * 3) + 1}`,
  };
}
