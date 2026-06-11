import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import popsRouter     from './routes/pops';
import camerasRouter  from './routes/cameras';
import eventsRouter   from './routes/events';
import sensorsRouter  from './routes/sensors';
import incidentsRouter from './routes/incidents';
import authRouter     from './routes/auth';
import statsRouter    from './routes/stats';
import anomalyRouter  from './routes/anomaly';
import projetsDpeRouter from './routes/projets-dpe';
import { setupSocketHandlers } from './socket/handlers';
import { errorHandler } from '../../src/utils/exception';
import { logger } from '../../src/utils/logger';
import { config } from '../../src/config/config';

dotenv.config();

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: config.server.frontendUrl,
    methods: ['GET', 'POST'],
  },
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: config.server.frontendUrl }));
app.use(morgan('dev'));
app.use(express.json());

app.use('/api/pops',       popsRouter);
app.use('/api/cameras',    camerasRouter);
app.use('/api/events',     eventsRouter);
app.use('/api/sensors',    sensorsRouter);
app.use('/api/incidents',  incidentsRouter);
app.use('/api/auth',       authRouter);
app.use('/api/stats',      statsRouter);
app.use('/api/anomaly',    anomalyRouter);
app.use('/api/projets-dpe', projetsDpeRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

setupSocketHandlers(io);

const PORT = config.server.port;
httpServer.listen(PORT, () => {
  logger.info(`Enertic AI Backend démarré`, { port: PORT, env: config.server.env });
});

export { io };
