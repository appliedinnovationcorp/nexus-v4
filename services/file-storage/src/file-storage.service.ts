import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as sharp from 'sharp';
import * as ffmpeg from 'fluent-ffmpeg';
import { fileTypeFromBuffer } from 'file-type';
import * as mime from 'mime-types';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface FileMetadata {
  id: string;
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  path: string;
  url: string;
  thumbnailUrl?: string;
  userId: string;
  folderId?: string;
  tags: string[];
  isPublic: boolean;
  uploadedAt: Date;
  lastAccessedAt?: Date;
  downloadCount: number;
  virusScanStatus: 'pending' | 'clean' | 'infected' | 'error';
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  metadata: {
    width?: number;
    height?: number;
    duration?: number;
    format?: string;
    compression?: string;
    [key: string]: any;
  };
}

export interface UploadOptions {
  userId: string;
  folderId?: string;
  tags?: string[];
  isPublic?: boolean;
  generateThumbnail?: boolean;
  maxSize?: number;
  allowedTypes?: string[];
}

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private s3Client: S3Client;
  private readonly bucketName: string;
  private readonly cdnUrl: string;
  private files = new Map<string, FileMetadata>();

  constructor(
    @InjectQueue('file-processing') private fileProcessingQueue: Queue,
    @InjectQueue('virus-scanning') private virusScanQueue: Queue,
    @InjectQueue('thumbnail-generation') private thumbnailQueue: Queue,
  ) {
    this.initializeS3();
    this.bucketName = process.env.AWS_S3_BUCKET || 'nexus-file-storage';
    this.cdnUrl = process.env.CDN_URL || 'https://cdn.nexus.dev';
  }

  private initializeS3(): void {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }

  // File Upload
  async uploadFile(
    file: Express.Multer.File,
    options: UploadOptions
  ): Promise<FileMetadata> {
    this.logger.debug(`Uploading file: ${file.originalname} (${file.size} bytes)`);

    // Validate file
    await this.validateFile(file, options);

    // Generate unique filename
    const fileId = this.generateFileId();
    const extension = path.extname(file.originalname);
    const filename = `${fileId}${extension}`;
    const filePath = this.generateFilePath(options.userId, filename);

    // Detect file type
    const detectedType = await fileTypeFromBuffer(file.buffer);
    const mimetype = detectedType?.mime || file.mimetype;

    // Create file metadata
    const fileMetadata: FileMetadata = {
      id: fileId,
      originalName: file.originalname,
      filename,
      mimetype,
      size: file.size,
      path: filePath,
      url: `${this.cdnUrl}/${filePath}`,
      userId: options.userId,
      folderId: options.folderId,
      tags: options.tags || [],
      isPublic: options.isPublic || false,
      uploadedAt: new Date(),
      downloadCount: 0,
      virusScanStatus: 'pending',
      processingStatus: 'pending',
      metadata: {},
    };

    try {
      // Upload to S3
      await this.uploadToS3(filePath, file.buffer, mimetype);

      // Store metadata
      this.files.set(fileId, fileMetadata);

      // Queue for virus scanning
      await this.virusScanQueue.add('scan-file', {
        fileId,
        filePath,
        userId: options.userId,
      });

      // Queue for processing
      await this.fileProcessingQueue.add('process-file', {
        fileId,
        filePath,
        mimetype,
        generateThumbnail: options.generateThumbnail,
      });

      this.logger.log(`File uploaded successfully: ${fileId}`);
      return fileMetadata;

    } catch (error) {
      this.logger.error(`Failed to upload file ${fileId}:`, error);
      throw error;
    }
  }

  // Multiple file upload
  async uploadMultipleFiles(
    files: Express.Multer.File[],
    options: UploadOptions
  ): Promise<FileMetadata[]> {
    this.logger.debug(`Uploading ${files.length} files`);

    const uploadPromises = files.map(file => this.uploadFile(file, options));
    return await Promise.all(uploadPromises);
  }

  // File Download
  async downloadFile(fileId: string, userId?: string): Promise<{
    stream: NodeJS.ReadableStream;
    metadata: FileMetadata;
  }> {
    const fileMetadata = this.files.get(fileId);
    if (!fileMetadata) {
      throw new BadRequestException(`File ${fileId} not found`);
    }

    // Check access permissions
    if (!fileMetadata.isPublic && fileMetadata.userId !== userId) {
      throw new BadRequestException('Access denied');
    }

    try {
      // Get file from S3
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fileMetadata.path,
      });

      const response = await this.s3Client.send(command);
      
      // Update access statistics
      fileMetadata.lastAccessedAt = new Date();
      fileMetadata.downloadCount++;
      this.files.set(fileId, fileMetadata);

      return {
        stream: response.Body as NodeJS.ReadableStream,
        metadata: fileMetadata,
      };

    } catch (error) {
      this.logger.error(`Failed to download file ${fileId}:`, error);
      throw error;
    }
  }

  // Generate presigned URL for direct download
  async getPresignedUrl(fileId: string, expiresIn: number = 3600): Promise<string> {
    const fileMetadata = this.files.get(fileId);
    if (!fileMetadata) {
      throw new BadRequestException(`File ${fileId} not found`);
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: fileMetadata.path,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  // File deletion
  async deleteFile(fileId: string, userId: string): Promise<void> {
    const fileMetadata = this.files.get(fileId);
    if (!fileMetadata) {
      throw new BadRequestException(`File ${fileId} not found`);
    }

    // Check ownership
    if (fileMetadata.userId !== userId) {
      throw new BadRequestException('Access denied');
    }

    try {
      // Delete from S3
      await this.deleteFromS3(fileMetadata.path);

      // Delete thumbnail if exists
      if (fileMetadata.thumbnailUrl) {
        const thumbnailPath = fileMetadata.path.replace(/\.[^/.]+$/, '_thumb.jpg');
        await this.deleteFromS3(thumbnailPath);
      }

      // Remove from metadata
      this.files.delete(fileId);

      this.logger.log(`File deleted successfully: ${fileId}`);

    } catch (error) {
      this.logger.error(`Failed to delete file ${fileId}:`, error);
      throw error;
    }
  }

  // File search and listing
  async listFiles(
    userId: string,
    options: {
      folderId?: string;
      tags?: string[];
      mimetype?: string;
      limit?: number;
      offset?: number;
      sortBy?: 'name' | 'size' | 'date';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{
    files: FileMetadata[];
    total: number;
    hasMore: boolean;
  }> {
    let userFiles = Array.from(this.files.values())
      .filter(file => file.userId === userId);

    // Apply filters
    if (options.folderId) {
      userFiles = userFiles.filter(file => file.folderId === options.folderId);
    }

    if (options.tags && options.tags.length > 0) {
      userFiles = userFiles.filter(file => 
        options.tags!.some(tag => file.tags.includes(tag))
      );
    }

    if (options.mimetype) {
      userFiles = userFiles.filter(file => 
        file.mimetype.startsWith(options.mimetype!)
      );
    }

    // Sort files
    const sortBy = options.sortBy || 'date';
    const sortOrder = options.sortOrder || 'desc';
    
    userFiles.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.originalName.localeCompare(b.originalName);
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'date':
          comparison = a.uploadedAt.getTime() - b.uploadedAt.getTime();
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // Pagination
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    const total = userFiles.length;
    const paginatedFiles = userFiles.slice(offset, offset + limit);

    return {
      files: paginatedFiles,
      total,
      hasMore: offset + limit < total,
    };
  }

  // File search
  async searchFiles(
    userId: string,
    query: string,
    options: {
      mimetype?: string;
      tags?: string[];
      limit?: number;
    } = {}
  ): Promise<FileMetadata[]> {
    const userFiles = Array.from(this.files.values())
      .filter(file => file.userId === userId);

    const searchResults = userFiles.filter(file => {
      // Search in filename and tags
      const searchText = `${file.originalName} ${file.tags.join(' ')}`.toLowerCase();
      const matchesQuery = searchText.includes(query.toLowerCase());

      // Apply additional filters
      const matchesMimetype = !options.mimetype || file.mimetype.startsWith(options.mimetype);
      const matchesTags = !options.tags || options.tags.some(tag => file.tags.includes(tag));

      return matchesQuery && matchesMimetype && matchesTags;
    });

    const limit = options.limit || 20;
    return searchResults.slice(0, limit);
  }

  // Folder management
  async createFolder(name: string, userId: string, parentId?: string): Promise<{
    id: string;
    name: string;
    parentId?: string;
    userId: string;
    createdAt: Date;
  }> {
    const folderId = this.generateFileId();
    
    const folder = {
      id: folderId,
      name,
      parentId,
      userId,
      createdAt: new Date(),
    };

    // In a real implementation, this would be stored in a database
    this.logger.log(`Created folder: ${name} (${folderId})`);
    
    return folder;
  }

  // File sharing
  async shareFile(fileId: string, userId: string, options: {
    expiresAt?: Date;
    password?: string;
    allowDownload?: boolean;
  } = {}): Promise<{
    shareId: string;
    shareUrl: string;
    expiresAt?: Date;
  }> {
    const fileMetadata = this.files.get(fileId);
    if (!fileMetadata || fileMetadata.userId !== userId) {
      throw new BadRequestException('File not found or access denied');
    }

    const shareId = this.generateFileId();
    const shareUrl = `${process.env.FRONTEND_URL}/share/${shareId}`;

    // In a real implementation, share data would be stored in database
    this.logger.log(`Created share link for file ${fileId}: ${shareId}`);

    return {
      shareId,
      shareUrl,
      expiresAt: options.expiresAt,
    };
  }

  // File statistics
  async getFileStats(userId: string): Promise<{
    totalFiles: number;
    totalSize: number;
    filesByType: Record<string, number>;
    storageUsed: number;
    storageLimit: number;
  }> {
    const userFiles = Array.from(this.files.values())
      .filter(file => file.userId === userId);

    const totalFiles = userFiles.length;
    const totalSize = userFiles.reduce((sum, file) => sum + file.size, 0);
    
    const filesByType: Record<string, number> = {};
    userFiles.forEach(file => {
      const type = file.mimetype.split('/')[0];
      filesByType[type] = (filesByType[type] || 0) + 1;
    });

    return {
      totalFiles,
      totalSize,
      filesByType,
      storageUsed: totalSize,
      storageLimit: 10 * 1024 * 1024 * 1024, // 10GB default limit
    };
  }

  // Private helper methods
  private async validateFile(file: Express.Multer.File, options: UploadOptions): Promise<void> {
    // Size validation
    const maxSize = options.maxSize || 100 * 1024 * 1024; // 100MB default
    if (file.size > maxSize) {
      throw new BadRequestException(`File size exceeds limit of ${maxSize} bytes`);
    }

    // Type validation
    if (options.allowedTypes && options.allowedTypes.length > 0) {
      const isAllowed = options.allowedTypes.some(type => 
        file.mimetype.startsWith(type) || file.mimetype === type
      );
      
      if (!isAllowed) {
        throw new BadRequestException(`File type ${file.mimetype} not allowed`);
      }
    }

    // Filename validation
    if (!file.originalname || file.originalname.length > 255) {
      throw new BadRequestException('Invalid filename');
    }
  }

  private generateFileId(): string {
    return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateFilePath(userId: string, filename: string): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `users/${userId}/${year}/${month}/${day}/${filename}`;
  }

  private async uploadToS3(key: string, buffer: Buffer, contentType: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await this.s3Client.send(command);
  }

  private async deleteFromS3(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.s3Client.send(command);
  }

  // Public API methods
  async getFileMetadata(fileId: string): Promise<FileMetadata | undefined> {
    return this.files.get(fileId);
  }

  async updateFileMetadata(
    fileId: string,
    userId: string,
    updates: Partial<Pick<FileMetadata, 'tags' | 'isPublic' | 'folderId'>>
  ): Promise<FileMetadata> {
    const fileMetadata = this.files.get(fileId);
    if (!fileMetadata || fileMetadata.userId !== userId) {
      throw new BadRequestException('File not found or access denied');
    }

    const updatedMetadata = { ...fileMetadata, ...updates };
    this.files.set(fileId, updatedMetadata);

    return updatedMetadata;
  }
}
