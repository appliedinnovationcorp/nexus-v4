import { IsString, IsOptional, IsObject, IsDateString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IngestEventDto {
  @ApiPropertyOptional({ description: 'Unique event identifier' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ description: 'Event type (e.g., page.view, user.login)' })
  @IsString()
  type: string;

  @ApiProperty({ description: 'Event source (e.g., web, mobile, api)' })
  @IsString()
  source: string;

  @ApiPropertyOptional({ description: 'User identifier' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Session identifier' })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({ description: 'Event timestamp' })
  @IsOptional()
  @IsDateString()
  timestamp?: Date;

  @ApiProperty({ description: 'Event data payload' })
  @IsObject()
  data: Record<string, any>;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class IngestEventsBatchDto {
  @ApiProperty({ 
    description: 'Array of events to ingest',
    type: [IngestEventDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngestEventDto)
  events: IngestEventDto[];
}
