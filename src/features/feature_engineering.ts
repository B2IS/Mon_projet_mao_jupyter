import { SensorReading } from '../entity/config_entity';

export interface SensorFeatures {
  popId: string;
  timestamp: string;
  tempNorm: number;        // temperature normalisée [0-1]
  humidityNorm: number;   // humidité normalisée [0-1]
  fuelNorm: number;        // niveau carburant normalisé [0-1]
  consumptionRate: number; // consommation normalisée [0-1]
  autonomyHours: number;   // autonomie calculée (heures)
  binaryFlags: number;     // smoke(bit0) | door(bit1) | presence(bit2)
  powerScore: number;      // 1.0=réseau+groupe, 0.5=groupe seul, 0.0=inconnu
}

const BOUNDS = {
  temperature:     { min: -10, max: 60 },
  humidity:        { min: 0,   max: 100 },
  fuelLevel:       { min: 0,   max: 100 },
  fuelConsumption: { min: 0,   max: 100 },
};

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

export function extractFeatures(reading: SensorReading): SensorFeatures {
  const autonomyHours = reading.fuelConsumption > 0
    ? +(reading.fuelLevel / 100 * reading.fuelCapacity / reading.fuelConsumption).toFixed(2)
    : 999;

  const binaryFlags =
    (reading.smokeDetected ? 0b001 : 0) |
    (reading.doorOpen       ? 0b010 : 0) |
    (reading.presence       ? 0b100 : 0);

  const powerScore =
    reading.powerSource.includes('Réseau') ? 1.0 :
    reading.powerSource.includes('Groupe') ? 0.5 : 0.0;

  return {
    popId:           reading.popId,
    timestamp:       reading.timestamp,
    tempNorm:        normalize(reading.temperature,     BOUNDS.temperature.min,     BOUNDS.temperature.max),
    humidityNorm:    normalize(reading.humidity,        BOUNDS.humidity.min,        BOUNDS.humidity.max),
    fuelNorm:        normalize(reading.fuelLevel,       BOUNDS.fuelLevel.min,       BOUNDS.fuelLevel.max),
    consumptionRate: normalize(reading.fuelConsumption, BOUNDS.fuelConsumption.min, BOUNDS.fuelConsumption.max),
    autonomyHours,
    binaryFlags,
    powerScore,
  };
}

export function extractFeaturesBatch(readings: SensorReading[]): SensorFeatures[] {
  return readings.map(extractFeatures);
}
