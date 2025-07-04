import { Injectable, Logger } from '@nestjs/common';

export interface MobileDevice {
  id: string;
  userId: string;
  deviceId: string;
  platform: 'ios' | 'android';
  appVersion: string;
  osVersion: string;
  pushToken?: string;
  isActive: boolean;
  lastSyncAt?: Date;
  createdAt: Date;
}

export interface SyncData {
  userId: string;
  deviceId: string;
  lastSyncTimestamp: Date;
  data: Record<string, any>;
  conflicts?: Array<{
    field: string;
    localValue: any;
    serverValue: any;
    resolution: 'local' | 'server' | 'merge';
  }>;
}

@Injectable()
export class MobileApiService {
  private readonly logger = new Logger(MobileApiService.name);
  private devices = new Map<string, MobileDevice>();
  private syncData = new Map<string, SyncData>();

  async registerDevice(deviceData: {
    userId: string;
    deviceId: string;
    platform: 'ios' | 'android';
    appVersion: string;
    osVersion: string;
    pushToken?: string;
  }): Promise<MobileDevice> {
    const deviceKey = `${deviceData.userId}_${deviceData.deviceId}`;
    
    const device: MobileDevice = {
      id: deviceKey,
      userId: deviceData.userId,
      deviceId: deviceData.deviceId,
      platform: deviceData.platform,
      appVersion: deviceData.appVersion,
      osVersion: deviceData.osVersion,
      pushToken: deviceData.pushToken,
      isActive: true,
      createdAt: new Date(),
    };

    this.devices.set(deviceKey, device);
    this.logger.log(`Mobile device registered: ${deviceData.platform} device for user ${deviceData.userId}`);

    return device;
  }

  async syncData(syncRequest: {
    userId: string;
    deviceId: string;
    lastSyncTimestamp: Date;
    data: Record<string, any>;
  }): Promise<SyncData> {
    const syncKey = `${syncRequest.userId}_${syncRequest.deviceId}`;
    
    // Simulate conflict detection and resolution
    const conflicts = this.detectConflicts(syncRequest.data);
    
    const syncData: SyncData = {
      userId: syncRequest.userId,
      deviceId: syncRequest.deviceId,
      lastSyncTimestamp: new Date(),
      data: syncRequest.data,
      conflicts,
    };

    this.syncData.set(syncKey, syncData);
    
    // Update device last sync
    const deviceKey = `${syncRequest.userId}_${syncRequest.deviceId}`;
    const device = this.devices.get(deviceKey);
    if (device) {
      device.lastSyncAt = new Date();
      this.devices.set(deviceKey, device);
    }

    this.logger.debug(`Data synced for device ${syncRequest.deviceId}`);
    return syncData;
  }

  private detectConflicts(data: Record<string, any>): Array<{
    field: string;
    localValue: any;
    serverValue: any;
    resolution: 'local' | 'server' | 'merge';
  }> {
    // Simulate conflict detection logic
    const conflicts = [];
    
    // In a real implementation, you would compare with server data
    // and detect conflicts based on timestamps, versions, etc.
    
    return conflicts;
  }

  async getDeviceAnalytics(): Promise<{
    totalDevices: number;
    activeDevices: number;
    platformBreakdown: Record<string, number>;
    appVersions: Record<string, number>;
  }> {
    const devices = Array.from(this.devices.values());
    const activeDevices = devices.filter(d => d.isActive);
    
    const platformBreakdown: Record<string, number> = {};
    const appVersions: Record<string, number> = {};
    
    devices.forEach(device => {
      platformBreakdown[device.platform] = (platformBreakdown[device.platform] || 0) + 1;
      appVersions[device.appVersion] = (appVersions[device.appVersion] || 0) + 1;
    });

    return {
      totalDevices: devices.length,
      activeDevices: activeDevices.length,
      platformBreakdown,
      appVersions,
    };
  }

  async getUserDevices(userId: string): Promise<MobileDevice[]> {
    return Array.from(this.devices.values())
      .filter(device => device.userId === userId);
  }
}
