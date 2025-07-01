import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiResponseDto<T = any> {
  @ApiProperty({ description: 'Response data' })
  data: T;

  @ApiProperty({ description: 'Success status' })
  success: boolean;

  @ApiPropertyOptional({ description: 'Response message' })
  message?: string;

  @ApiPropertyOptional({ description: 'Error messages', type: [String] })
  errors?: string[];

  constructor(data: T, success: boolean = true, message?: string, errors?: string[]) {
    this.data = data;
    this.success = success;
    this.message = message;
    this.errors = errors;
  }
}

export class PaginatedResponseDto<T = any> extends ApiResponseDto<T[]> {
  @ApiProperty({ description: 'Pagination information' })
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };

  constructor(
    data: T[],
    pagination: { page: number; limit: number; total: number; totalPages: number },
    message?: string,
  ) {
    super(data, true, message);
    this.pagination = pagination;
  }
}
