import { Controller, Post, Get, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DataIngestionService, AnalyticsEvent } from './data-ingestion.service';
import { IngestEventDto, IngestEventsBatchDto } from './dto/ingest-event.dto';

@ApiTags('Data Ingestion')
@ApiBearerAuth()
@Controller('api/v1/ingest')
export class DataIngestionController {
  constructor(private readonly dataIngestionService: DataIngestionService) {}

  @Post('event')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Ingest a single analytics event' })
  @ApiResponse({ status: 202, description: 'Event accepted for processing' })
  @ApiResponse({ status: 400, description: 'Invalid event data' })
  async ingestEvent(@Body() eventDto: IngestEventDto): Promise<{ message: string }> {
    const event: AnalyticsEvent = {
      id: eventDto.id || crypto.randomUUID(),
      type: eventDto.type,
      source: eventDto.source,
      userId: eventDto.userId,
      sessionId: eventDto.sessionId,
      timestamp: eventDto.timestamp || new Date(),
      data: eventDto.data,
      metadata: eventDto.metadata,
    };

    await this.dataIngestionService.ingestEvent(event);
    
    return { message: 'Event accepted for processing' };
  }

  @Post('events/batch')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Ingest multiple analytics events in batch' })
  @ApiResponse({ status: 202, description: 'Events accepted for processing' })
  @ApiResponse({ status: 400, description: 'Invalid batch data' })
  async ingestEventsBatch(@Body() batchDto: IngestEventsBatchDto): Promise<{ 
    message: string; 
    count: number 
  }> {
    const events: AnalyticsEvent[] = batchDto.events.map(eventDto => ({
      id: eventDto.id || crypto.randomUUID(),
      type: eventDto.type,
      source: eventDto.source,
      userId: eventDto.userId,
      sessionId: eventDto.sessionId,
      timestamp: eventDto.timestamp || new Date(),
      data: eventDto.data,
      metadata: eventDto.metadata,
    }));

    await this.dataIngestionService.ingestEventsBatch(events);
    
    return { 
      message: 'Events accepted for processing',
      count: events.length
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get data ingestion statistics' })
  @ApiResponse({ status: 200, description: 'Ingestion statistics retrieved' })
  async getIngestionStats() {
    return await this.dataIngestionService.getIngestionStats();
  }

  @Get('health')
  @ApiOperation({ summary: 'Get ingestion service health status' })
  @ApiResponse({ status: 200, description: 'Health status retrieved' })
  async getHealth() {
    return await this.dataIngestionService.getHealth();
  }
}
