import { Server } from 'socket.io';
import { generateEvent, fetchSensorReading, POPS } from '../../../src/data/ingestion';
import { generateNetworkData } from '../../../src/data/transformation';
import { logger } from '../../../src/utils/logger';

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket) => {
    logger.debug('Client connecté', { id: socket.id });

    socket.on('subscribe:pop', (popId: string) => {
      socket.join(`pop:${popId}`);
    });

    socket.on('unsubscribe:pop', (popId: string) => {
      socket.leave(`pop:${popId}`);
    });

    socket.on('disconnect', () => {
      logger.debug('Client déconnecté', { id: socket.id });
    });
  });

  // Sensor updates every 5 s
  setInterval(() => {
    const pop = POPS[Math.floor(Math.random() * POPS.length)];
    const data = fetchSensorReading(pop.id);
    io.to(`pop:${pop.id}`).emit('sensor:update', data);
    io.emit('sensor:update:global', { popId: pop.id, ...data });
  }, 5000);

  // Network stats every 3 s
  setInterval(() => {
    io.emit('network:update', generateNetworkData());
  }, 3000);

  // Random events every 15–30 s
  const emitRandomEvent = () => {
    io.emit('event:new', generateEvent());
    setTimeout(emitRandomEvent, 15000 + Math.random() * 15000);
  };
  setTimeout(emitRandomEvent, 10000);
}
