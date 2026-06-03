import { Module } from '@nestjs/common';
import { ProgrammeController } from './programme.controller';

@Module({ controllers: [ProgrammeController], providers: [] })
export class ProgrammeModule {}
