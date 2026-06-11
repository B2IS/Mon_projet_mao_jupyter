import dotenv from 'dotenv';
dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '4000'),
    env: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  },

  database: {
    url: process.env.DATABASE_URL || 'postgresql://enertic:enertic123@localhost:5432/enertic_ai',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'enertic_ai',
    user: process.env.DB_USER || 'enertic',
    password: process.env.DB_PASSWORD || 'enertic123',
    timescaleEnabled: process.env.TIMESCALE_ENABLED === 'true',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET || 'enertic_ai_secret_key_change_in_production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },

  rtsp: {
    // Timeout for stream connection attempts (ms)
    connectTimeoutMs: parseInt(process.env.RTSP_TIMEOUT || '5000'),
    // Interval between reconnection attempts (ms)
    retryIntervalMs: parseInt(process.env.RTSP_RETRY_INTERVAL || '30000'),
    // Max concurrent stream decoders
    maxStreams: parseInt(process.env.RTSP_MAX_STREAMS || '16'),
  },

  sensors: {
    // Polling interval for HTTP sensors (ms)
    httpPollIntervalMs: parseInt(process.env.SENSOR_HTTP_POLL_MS || '10000'),
    // MQTT broker URL
    mqttBrokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
  },

  ml: {
    // Confidence threshold above which an anomaly is reported
    anomalyThreshold: parseFloat(process.env.ANOMALY_THRESHOLD || '0.85'),
    // Directory where trained model artifacts are stored
    modelPath: process.env.MODEL_PATH || './models',
    // Retrain interval (ms). Default: 24 h
    retrainIntervalMs: parseInt(process.env.RETRAIN_INTERVAL || '86400000'),
    // Lookback window for training (hours)
    trainingWindowHours: parseInt(process.env.TRAINING_WINDOW_HOURS || '168'),
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || './logs',
  },
};

export type Config = typeof config;
