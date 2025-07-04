import {
  ResourceGroupsTaggingAPIClient,
  GetResourcesCommand,
  TagResourcesCommand,
  UntagResourcesCommand,
  GetTagKeysCommand,
  GetTagValuesCommand,
} from '@aws-sdk/client-resource-groups-tagging-api';
import {
  EC2Client,
  DescribeInstancesCommand,
  CreateTagsCommand as EC2CreateTagsCommand,
  DeleteTagsCommand as EC2DeleteTagsCommand,
} from '@aws-sdk/client-ec2';
import { ResourceTags, ResourceTagSchema, FinOpsConfig } from '../types';
import { SecretManager } from '@nexus/secret-management';
import { AnalyticsTracker } from '@nexus/analytics';

export class ResourceTaggingManager {
  private resourceGroupsClient: ResourceGroupsTaggingAPIClient;
  private ec2Client: EC2Client;
  private secretManager: SecretManager;
  private analytics: AnalyticsTracker;
  private config: FinOpsConfig;

  constructor(config: FinOpsConfig) {
    this.config = config;
    this.resourceGroupsClient = new ResourceGroupsTaggingAPIClient({
      region: config.aws.region,
    });
    this.ec2Client = new EC2Client({
      region: config.aws.region,
    });
    this.secretManager = new SecretManager();
    this.analytics = new AnalyticsTracker();
  }

  /**
   * Get all resources with their current tags
   */
  async getAllResources(filters?: {
    resourceTypes?: string[];
    tagFilters?: Record<string, string[]>;
  }): Promise<Array<{
    resourceArn: string;
    resourceType: string;
    tags: Record<string, string>;
  }>> {
    try {
      const command = new GetResourcesCommand({
        ResourceTypeFilters: filters?.resourceTypes,
        TagFilters: filters?.tagFilters ? Object.entries(filters.tagFilters).map(([key, values]) => ({
          Key: key,
          Values: values,
        })) : undefined,
        ResourcesPerPage: 100,
      });

      const resources: Array<{
        resourceArn: string;
        resourceType: string;
        tags: Record<string, string>;
      }> = [];

      let paginationToken: string | undefined;
      
      do {
        if (paginationToken) {
          command.input.PaginationToken = paginationToken;
        }

        const response = await this.resourceGroupsClient.send(command);
        
        if (response.ResourceTagMappingList) {
          for (const resource of response.ResourceTagMappingList) {
            if (resource.ResourceARN) {
              const tags: Record<string, string> = {};
              if (resource.Tags) {
                for (const tag of resource.Tags) {
                  if (tag.Key && tag.Value) {
                    tags[tag.Key] = tag.Value;
                  }
                }
              }

              resources.push({
                resourceArn: resource.ResourceARN,
                resourceType: this.extractResourceType(resource.ResourceARN),
                tags,
              });
            }
          }
        }

        paginationToken = response.PaginationToken;
      } while (paginationToken);

      await this.analytics.track('finops.resources.listed', {
        resourceCount: resources.length,
        filters: filters || {},
      });

      return resources;
    } catch (error) {
      await this.analytics.track('finops.resources.list_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filters: filters || {},
      });
      throw error;
    }
  }

  /**
   * Validate resource tags against schema and rules
   */
  async validateResourceTags(
    resourceArn: string,
    tags: Record<string, string>
  ): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    missingRequiredTags: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const missingRequiredTags: string[] = [];

    try {
      // Validate against schema
      const validationResult = ResourceTagSchema.safeParse(tags);
      if (!validationResult.success) {
        for (const issue of validationResult.error.issues) {
          if (issue.code === 'invalid_enum_value') {
            errors.push(`Invalid value for ${issue.path.join('.')}: ${issue.received}`);
          } else if (issue.code === 'too_small') {
            errors.push(`${issue.path.join('.')} is required`);
          } else {
            errors.push(`${issue.path.join('.')}: ${issue.message}`);
          }
        }
      }

      // Check required tags
      if (this.config.tagging.enforceRequiredTags) {
        for (const requiredTag of this.config.tagging.requiredTags) {
          if (!tags[requiredTag]) {
            missingRequiredTags.push(requiredTag);
          }
        }
      }

      // Validate against custom rules
      for (const [tagKey, rule] of Object.entries(this.config.tagging.tagValidationRules)) {
        const tagValue = tags[tagKey];
        if (tagValue && !rule.test(tagValue)) {
          errors.push(`Tag ${tagKey} value "${tagValue}" does not match required pattern`);
        }
      }

      // Check for common issues
      const resourceType = this.extractResourceType(resourceArn);
      if (resourceType === 'ec2:instance' && !tags.AutoShutdown) {
        warnings.push('Consider adding AutoShutdown tag for cost optimization');
      }

      if (!tags.Owner || !tags.Owner.includes('@')) {
        warnings.push('Owner tag should contain a valid email address');
      }

      const isValid = errors.length === 0 && missingRequiredTags.length === 0;

      await this.analytics.track('finops.tags.validated', {
        resourceArn,
        resourceType,
        isValid,
        errorCount: errors.length,
        warningCount: warnings.length,
        missingTagCount: missingRequiredTags.length,
      });

      return {
        isValid,
        errors,
        warnings,
        missingRequiredTags,
      };
    } catch (error) {
      await this.analytics.track('finops.tags.validation_error', {
        resourceArn,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Apply tags to resources
   */
  async tagResources(
    resourceArns: string[],
    tags: Record<string, string>
  ): Promise<{
    successful: string[];
    failed: Array<{ resourceArn: string; error: string }>;
  }> {
    const successful: string[] = [];
    const failed: Array<{ resourceArn: string; error: string }> = [];

    try {
      // Validate tags first
      const validationResult = ResourceTagSchema.safeParse(tags);
      if (!validationResult.success) {
        throw new Error(`Invalid tags: ${validationResult.error.message}`);
      }

      // Convert tags to AWS format
      const awsTags = Object.entries(tags).map(([key, value]) => ({
        Key: key,
        Value: value,
      }));

      // Use Resource Groups Tagging API for most resources
      try {
        const command = new TagResourcesCommand({
          ResourceARNList: resourceArns,
          Tags: Object.fromEntries(Object.entries(tags)),
        });

        const response = await this.resourceGroupsClient.send(command);
        
        if (response.FailedResourcesMap) {
          for (const [arn, failureInfo] of Object.entries(response.FailedResourcesMap)) {
            failed.push({
              resourceArn: arn,
              error: failureInfo.ErrorMessage || 'Unknown error',
            });
          }
        }

        // Add successful resources
        for (const arn of resourceArns) {
          if (!response.FailedResourcesMap?.[arn]) {
            successful.push(arn);
          }
        }
      } catch (error) {
        // Fallback to service-specific APIs for resources that don't support Resource Groups API
        for (const arn of resourceArns) {
          try {
            await this.tagResourceWithServiceAPI(arn, tags);
            successful.push(arn);
          } catch (serviceError) {
            failed.push({
              resourceArn: arn,
              error: serviceError instanceof Error ? serviceError.message : 'Unknown error',
            });
          }
        }
      }

      await this.analytics.track('finops.tags.applied', {
        resourceCount: resourceArns.length,
        successfulCount: successful.length,
        failedCount: failed.length,
        tags: Object.keys(tags),
      });

      return { successful, failed };
    } catch (error) {
      await this.analytics.track('finops.tags.apply_error', {
        resourceCount: resourceArns.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Remove tags from resources
   */
  async untagResources(
    resourceArns: string[],
    tagKeys: string[]
  ): Promise<{
    successful: string[];
    failed: Array<{ resourceArn: string; error: string }>;
  }> {
    const successful: string[] = [];
    const failed: Array<{ resourceArn: string; error: string }> = [];

    try {
      const command = new UntagResourcesCommand({
        ResourceARNList: resourceArns,
        TagKeys: tagKeys,
      });

      const response = await this.resourceGroupsClient.send(command);
      
      if (response.FailedResourcesMap) {
        for (const [arn, failureInfo] of Object.entries(response.FailedResourcesMap)) {
          failed.push({
            resourceArn: arn,
            error: failureInfo.ErrorMessage || 'Unknown error',
          });
        }
      }

      // Add successful resources
      for (const arn of resourceArns) {
        if (!response.FailedResourcesMap?.[arn]) {
          successful.push(arn);
        }
      }

      await this.analytics.track('finops.tags.removed', {
        resourceCount: resourceArns.length,
        successfulCount: successful.length,
        failedCount: failed.length,
        tagKeys,
      });

      return { successful, failed };
    } catch (error) {
      await this.analytics.track('finops.tags.remove_error', {
        resourceCount: resourceArns.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Auto-tag resources based on configuration
   */
  async autoTagResources(resourceArns: string[]): Promise<{
    successful: string[];
    failed: Array<{ resourceArn: string; error: string }>;
  }> {
    if (!this.config.tagging.autoTagging.enabled) {
      return { successful: [], failed: [] };
    }

    const defaultTags = this.config.tagging.autoTagging.defaultTags;
    const enrichedTags: Record<string, string> = {};

    // Add default tags
    for (const [key, value] of Object.entries(defaultTags)) {
      if (value) {
        enrichedTags[key] = value;
      }
    }

    // Add automatic tags
    enrichedTags.CreatedDate = new Date().toISOString().split('T')[0];
    enrichedTags.CreatedBy = 'auto-tagging-system';

    // Get current user/role for Owner tag if not set
    if (!enrichedTags.Owner) {
      try {
        const identity = await this.getCurrentIdentity();
        if (identity.email) {
          enrichedTags.Owner = identity.email;
        }
      } catch (error) {
        // Ignore error, Owner tag will be missing
      }
    }

    return this.tagResources(resourceArns, enrichedTags);
  }

  /**
   * Get tag compliance report
   */
  async getTagComplianceReport(filters?: {
    resourceTypes?: string[];
    accounts?: string[];
  }): Promise<{
    totalResources: number;
    compliantResources: number;
    nonCompliantResources: number;
    compliancePercentage: number;
    missingTags: Record<string, number>;
    resourceBreakdown: Record<string, {
      total: number;
      compliant: number;
      compliancePercentage: number;
    }>;
  }> {
    const resources = await this.getAllResources({
      resourceTypes: filters?.resourceTypes,
    });

    let compliantCount = 0;
    const missingTags: Record<string, number> = {};
    const resourceBreakdown: Record<string, {
      total: number;
      compliant: number;
      compliancePercentage: number;
    }> = {};

    for (const resource of resources) {
      const resourceType = resource.resourceType;
      
      if (!resourceBreakdown[resourceType]) {
        resourceBreakdown[resourceType] = {
          total: 0,
          compliant: 0,
          compliancePercentage: 0,
        };
      }
      resourceBreakdown[resourceType].total++;

      const validation = await this.validateResourceTags(resource.resourceArn, resource.tags);
      
      if (validation.isValid) {
        compliantCount++;
        resourceBreakdown[resourceType].compliant++;
      } else {
        // Track missing tags
        for (const missingTag of validation.missingRequiredTags) {
          missingTags[missingTag] = (missingTags[missingTag] || 0) + 1;
        }
      }
    }

    // Calculate compliance percentages
    for (const [resourceType, breakdown] of Object.entries(resourceBreakdown)) {
      breakdown.compliancePercentage = breakdown.total > 0 
        ? (breakdown.compliant / breakdown.total) * 100 
        : 0;
    }

    const totalResources = resources.length;
    const compliancePercentage = totalResources > 0 
      ? (compliantCount / totalResources) * 100 
      : 0;

    const report = {
      totalResources,
      compliantResources: compliantCount,
      nonCompliantResources: totalResources - compliantCount,
      compliancePercentage,
      missingTags,
      resourceBreakdown,
    };

    await this.analytics.track('finops.compliance.report_generated', {
      totalResources,
      compliancePercentage,
      resourceTypes: Object.keys(resourceBreakdown),
    });

    return report;
  }

  /**
   * Get all available tag keys
   */
  async getAvailableTagKeys(): Promise<string[]> {
    try {
      const command = new GetTagKeysCommand({});
      const response = await this.resourceGroupsClient.send(command);
      return response.TagKeys || [];
    } catch (error) {
      await this.analytics.track('finops.tags.get_keys_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get available values for a tag key
   */
  async getAvailableTagValues(tagKey: string): Promise<string[]> {
    try {
      const command = new GetTagValuesCommand({
        Key: tagKey,
      });
      const response = await this.resourceGroupsClient.send(command);
      return response.TagValues || [];
    } catch (error) {
      await this.analytics.track('finops.tags.get_values_error', {
        tagKey,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private extractResourceType(arn: string): string {
    const parts = arn.split(':');
    if (parts.length >= 6) {
      return `${parts[2]}:${parts[5].split('/')[0]}`;
    }
    return 'unknown';
  }

  private async tagResourceWithServiceAPI(
    resourceArn: string,
    tags: Record<string, string>
  ): Promise<void> {
    const resourceType = this.extractResourceType(resourceArn);
    
    if (resourceType.startsWith('ec2:')) {
      const instanceId = resourceArn.split('/').pop();
      if (instanceId) {
        const awsTags = Object.entries(tags).map(([key, value]) => ({
          Key: key,
          Value: value,
        }));

        const command = new EC2CreateTagsCommand({
          Resources: [instanceId],
          Tags: awsTags,
        });

        await this.ec2Client.send(command);
      }
    }
    // Add more service-specific implementations as needed
  }

  private async getCurrentIdentity(): Promise<{ email?: string; userId?: string }> {
    // This would typically use STS to get current identity
    // For now, return empty object
    return {};
  }
}
