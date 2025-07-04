import { Injectable, Logger } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';

export interface SearchDocument {
  id: string;
  title: string;
  content: string;
  type: string;
  userId: string;
  tags: string[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchResult {
  id: string;
  title: string;
  content: string;
  type: string;
  score: number;
  highlights: Record<string, string[]>;
  metadata: Record<string, any>;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private client: Client;
  private readonly indexName = 'nexus-search';

  constructor() {
    this.initializeElasticsearch();
  }

  private initializeElasticsearch(): void {
    this.client = new Client({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      auth: {
        username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
        password: process.env.ELASTICSEARCH_PASSWORD || 'changeme',
      },
    });

    this.logger.log('Elasticsearch client initialized');
  }

  async indexDocument(document: SearchDocument): Promise<void> {
    try {
      await this.client.index({
        index: this.indexName,
        id: document.id,
        body: document,
      });

      this.logger.debug(`Document indexed: ${document.id}`);
    } catch (error) {
      this.logger.error(`Failed to index document ${document.id}:`, error);
      throw error;
    }
  }

  async search(
    query: string,
    options: {
      type?: string;
      userId?: string;
      tags?: string[];
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    results: SearchResult[];
    total: number;
    took: number;
  }> {
    try {
      const searchBody: any = {
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query,
                  fields: ['title^2', 'content', 'tags'],
                  type: 'best_fields',
                  fuzziness: 'AUTO',
                },
              },
            ],
            filter: [],
          },
        },
        highlight: {
          fields: {
            title: {},
            content: {},
          },
        },
        size: options.limit || 20,
        from: options.offset || 0,
      };

      // Add filters
      if (options.type) {
        searchBody.query.bool.filter.push({ term: { type: options.type } });
      }

      if (options.userId) {
        searchBody.query.bool.filter.push({ term: { userId: options.userId } });
      }

      if (options.tags && options.tags.length > 0) {
        searchBody.query.bool.filter.push({ terms: { tags: options.tags } });
      }

      const response = await this.client.search({
        index: this.indexName,
        body: searchBody,
      });

      const results: SearchResult[] = response.body.hits.hits.map((hit: any) => ({
        id: hit._id,
        title: hit._source.title,
        content: hit._source.content,
        type: hit._source.type,
        score: hit._score,
        highlights: hit.highlight || {},
        metadata: hit._source.metadata,
      }));

      return {
        results,
        total: response.body.hits.total.value,
        took: response.body.took,
      };
    } catch (error) {
      this.logger.error('Search failed:', error);
      throw error;
    }
  }

  async suggest(query: string, field: string = 'title'): Promise<string[]> {
    try {
      const response = await this.client.search({
        index: this.indexName,
        body: {
          suggest: {
            suggestions: {
              text: query,
              completion: {
                field: `${field}.suggest`,
                size: 10,
              },
            },
          },
        },
      });

      return response.body.suggest.suggestions[0].options.map((option: any) => option.text);
    } catch (error) {
      this.logger.error('Suggestion failed:', error);
      return [];
    }
  }
}
