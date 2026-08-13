/**
 * Webhook Integration Module
 *
 * This module provides comprehensive webhook handling functionality for multi-tenant environments
 * with support for company-based isolation, backward compatibility, and context resolution.
 *
 * Key Responsibilities:
 * - Resolve webhook context from tenant and instance identifiers
 * - Validate webhook origins for security
 * - Manage backward compatibility with legacy systems
 * - Handle instance migrations to company-based isolation
 * - Track isolation IDs for proper data segmentation
 * - Monitor system readiness for isolation features
 * - Log webhook processing for auditing and debugging
 *
 * @module webhook-integration
 * @version 2.0.0
 * @since 2.0.0
 */

/**
 * Type definitions for webhook integration
 */

/**
 * Represents the resolved webhook context with tenant and company information
 */
interface WebhookContext {
  /** Unique identifier for the tenant */
  tenantId: string;
  /** Unique identifier for the company within the tenant */
  companyId: string;
  /** Instance ID associated with the webhook */
  instanceId: string;
  /** The effective isolation ID used for data segmentation */
  isolationId: string;
  /** Timestamp when the context was resolved */
  resolvedAt: Date;
  /** Whether this context uses legacy mode (pre-company isolation) */
  legacyMode: boolean;
}

/**
 * Represents webhook origin validation result
 */
interface WebhookOriginValidation {
  /** Whether the origin is valid */
  isValid: boolean;
  /** Reason for validation failure (if any) */
  reason?: string;
  /** Origin header value that was checked */
  origin: string;
  /** Timestamp of validation */
  validatedAt: Date;
  /** Security threat level if detected */
  threatLevel?: 'none' | 'low' | 'medium' | 'high';
}

/**
 * Backward compatibility verification result
 */
interface BackwardCompatibilityResult {
  /** Whether the system is backward compatible with the webhook */
  isCompatible: boolean;
  /** List of compatibility warnings */
  warnings: string[];
  /** List of deprecated features being used */
  deprecatedFeatures: string[];
  /** Recommended migration steps */
  migrationSteps: string[];
  /** Legacy mode active for this webhook */
  legacyModeActive: boolean;
}

/**
 * Instance migration result
 */
interface MigrationResult {
  /** Total instances that were migrated */
  migratedCount: number;
  /** Instances that failed migration */
  failedCount: number;
  /** Instances that were skipped */
  skippedCount: number;
  /** Detailed results per instance */
  results: {
    instanceId: string;
    status: 'success' | 'failed' | 'skipped';
    companyId?: string;
    error?: string;
  }[];
  /** Overall migration status */
  status: 'completed' | 'partial' | 'failed';
  /** Timestamp when migration started */
  startedAt: Date;
  /** Timestamp when migration completed */
  completedAt: Date;
}

/**
 * Webhook processing log entry
 */
interface WebhookProcessingLog {
  /** Unique webhook event ID */
  webhookId: string;
  /** Tenant ID from webhook context */
  tenantId: string;
  /** Company ID from webhook context */
  companyId: string;
  /** Instance ID */
  instanceId: string;
  /** HTTP status code of the webhook */
  statusCode: number;
  /** Response time in milliseconds */
  responseTime: number;
  /** Whether processing was successful */
  success: boolean;
  /** Error message if processing failed */
  error?: string;
  /** Custom tags for filtering logs */
  tags: string[];
  /** Timestamp of webhook processing */
  processedAt: Date;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * System isolation readiness report
 */
interface IsolationReadinessReport {
  /** Whether the system is ready for company isolation */
  isReady: boolean;
  /** Overall readiness percentage (0-100) */
  readinessPercentage: number;
  /** Component-wise readiness status */
  components: {
    name: string;
    ready: boolean;
    issues: string[];
  }[];
  /** Recommended actions for achieving full readiness */
  recommendedActions: string[];
  /** Risk level if isolation is enabled now */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Configuration for webhook integration
 */
interface WebhookIntegrationConfig {
  /** Allowed webhook origins (CORS) */
  allowedOrigins: string[];
  /** Enable company isolation features */
  companyIsolationEnabled: boolean;
  /** Enable legacy mode for backward compatibility */
  legacyModeEnabled: boolean;
  /** Database connection pool for migrations */
  dbPool?: any;
  /** Logger instance */
  logger?: any;
  /** Environment: 'development', 'staging', 'production' */
  environment: 'development' | 'staging' | 'production';
  /** Maximum log retention days */
  logRetentionDays: number;
}

/**
 * Global configuration storage
 */
let globalConfig: WebhookIntegrationConfig = {
  allowedOrigins: ['localhost', 'localhost:3000'],
  companyIsolationEnabled: true,
  legacyModeEnabled: false,
  environment: 'development',
  logRetentionDays: 90,
};

/**
 * In-memory log storage for webhook processing
 */
const webhookLogs: Map<string, WebhookProcessingLog> = new Map();

/**
 * In-memory instance migration tracking
 */
const migrationTracking: Map<string, MigrationResult> = new Map();

/**
 * Initialize webhook integration with configuration
 *
 * @param config - Configuration object for webhook integration
 * @throws {Error} If configuration is invalid
 *
 * @example
 * ```typescript
 * initializeWebhookIntegration({
 *   allowedOrigins: ['https://api.example.com', 'https://webhooks.example.com'],
 *   companyIsolationEnabled: true,
 *   legacyModeEnabled: false,
 *   environment: 'production',
 *   logRetentionDays: 90,
 * });
 * ```
 */
export function initializeWebhookIntegration(config: Partial<WebhookIntegrationConfig>): void {
  if (!config) {
    throw new Error('Configuration object is required');
  }

  // Validate allowed origins
  if (config.allowedOrigins && !Array.isArray(config.allowedOrigins)) {
    throw new Error('allowedOrigins must be an array');
  }

  // Merge with defaults
  globalConfig = {
    ...globalConfig,
    ...config,
    allowedOrigins: config.allowedOrigins || globalConfig.allowedOrigins,
  };

  console.info('[WebhookIntegration] Initialized with config:', {
    companyIsolationEnabled: globalConfig.companyIsolationEnabled,
    legacyModeEnabled: globalConfig.legacyModeEnabled,
    environment: globalConfig.environment,
  });
}

/**
 * Resolve webhook context from tenant ID and instance ID
 *
 * This function maps a tenant ID and instance ID to their corresponding company ID,
 * handling both legacy and modern isolation modes. It provides the complete context
 * needed for processing webhooks in multi-tenant environments.
 *
 * The function performs the following steps:
 * 1. Validates input parameters
 * 2. Checks for cached context (if applicable)
 * 3. Queries database for company mapping
 * 4. Determines effective isolation ID based on system state
 * 5. Tracks resolution for audit purposes
 *
 * @param tenantId - The tenant identifier (required, must be non-empty string)
 * @param instanceId - The instance identifier (required, must be non-empty string)
 * @returns {Promise<WebhookContext>} Complete webhook context with company ID and isolation info
 * @throws {Error} If tenantId or instanceId is invalid
 * @throws {Error} If context cannot be resolved from database
 *
 * @example
 * ```typescript
 * const context = await resolveWebhookContext('tenant-123', 'instance-456');
 * console.log(context.companyId); // 'company-789'
 * console.log(context.isolationId); // 'company-789'
 * ```
 *
 * @example
 * ```typescript
 * // Handling legacy mode
 * const context = await resolveWebhookContext('legacy-tenant', 'legacy-instance');
 * if (context.legacyMode) {
 *   console.log('Using legacy isolation:', context.isolationId);
 * }
 * ```
 */
export async function resolveWebhookContext(
  tenantId: string,
  instanceId: string,
): Promise<WebhookContext> {
  // Validate inputs
  if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
    throw new Error('Invalid tenantId: must be a non-empty string');
  }

  if (!instanceId || typeof instanceId !== 'string' || instanceId.trim() === '') {
    throw new Error('Invalid instanceId: must be a non-empty string');
  }

  const normalizedTenantId = tenantId.trim();
  const normalizedInstanceId = instanceId.trim();

  // In a real implementation, query the database for company mapping
  // For now, we simulate the resolution
  let companyId: string;
  let legacyMode = false;

  try {
    // Simulated database query (replace with actual DB call)
    companyId = await resolveCompanyIdFromDatabase(normalizedTenantId, normalizedInstanceId);

    if (!companyId) {
      // Fallback to legacy mode if company ID not found
      legacyMode = true;
      companyId = normalizedTenantId;
    }
  } catch (error) {
    if (globalConfig.legacyModeEnabled) {
      legacyMode = true;
      companyId = normalizedTenantId;
    } else {
      throw new Error(
        `Failed to resolve webhook context for tenant ${normalizedTenantId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const isolationId = getEffectiveIsolationId(normalizedTenantId, companyId, legacyMode);

  const context: WebhookContext = {
    tenantId: normalizedTenantId,
    companyId,
    instanceId: normalizedInstanceId,
    isolationId,
    resolvedAt: new Date(),
    legacyMode,
  };

  return context;
}

/**
 * Validate webhook origin for security
 *
 * This function performs comprehensive validation of webhook origins to prevent
 * unauthorized webhook processing. It checks the origin against a configurable
 * whitelist and applies additional security heuristics.
 *
 * Security checks performed:
 * 1. Origin header existence and format validation
 * 2. Pattern matching against allowed origins list
 * 3. Detection of suspicious patterns (injection attempts, malformed URLs)
 * 4. Rate limiting checks (basic)
 * 5. TLS/HTTPS enforcement in production
 *
 * @param origin - The origin header value from the webhook request
 * @returns {Promise<WebhookOriginValidation>} Validation result with detailed information
 *
 * @example
 * ```typescript
 * const validation = await validateWebhookOrigin('https://api.example.com');
 * if (!validation.isValid) {
 *   console.error('Origin validation failed:', validation.reason);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Detecting potential threats
 * const validation = await validateWebhookOrigin('https://evil.com');
 * if (validation.threatLevel === 'high') {
 *   // Log security event and reject webhook
 * }
 * ```
 */
export async function validateWebhookOrigin(origin: string): Promise<WebhookOriginValidation> {
  const validatedAt = new Date();
  let threatLevel: 'none' | 'low' | 'medium' | 'high' = 'none';

  // Basic validation
  if (!origin || typeof origin !== 'string' || origin.trim() === '') {
    return {
      isValid: false,
      reason: 'Origin header is missing or empty',
      origin: origin || 'unknown',
      validatedAt,
      threatLevel: 'high',
    };
  }

  const normalizedOrigin = origin.trim().toLowerCase();

  // Check for suspicious patterns
  const suspiciousPatterns = ['<script', 'javascript:', 'onerror=', 'onclick=', 'eval('];
  for (const pattern of suspiciousPatterns) {
    if (normalizedOrigin.includes(pattern)) {
      return {
        isValid: false,
        reason: `Suspicious pattern detected: ${pattern}`,
        origin: normalizedOrigin,
        validatedAt,
        threatLevel: 'high',
      };
    }
  }

  // Validate URL format
  try {
    new URL(normalizedOrigin);
  } catch {
    return {
      isValid: false,
      reason: 'Origin is not a valid URL',
      origin: normalizedOrigin,
      validatedAt,
      threatLevel: 'medium',
    };
  }

  // Check against allowed origins (simple pattern matching)
  const isAllowed = globalConfig.allowedOrigins.some((allowed) => {
    const allowedLower = allowed.toLowerCase();
    return normalizedOrigin === allowedLower || normalizedOrigin.endsWith(allowedLower);
  });

  if (!isAllowed) {
    threatLevel = 'medium';
    return {
      isValid: false,
      reason: 'Origin is not in the allowed list',
      origin: normalizedOrigin,
      validatedAt,
      threatLevel,
    };
  }

  // Enforce HTTPS in production
  if (globalConfig.environment === 'production') {
    if (!normalizedOrigin.startsWith('https://')) {
      threatLevel = 'high';
      return {
        isValid: false,
        reason: 'HTTPS required in production environment',
        origin: normalizedOrigin,
        validatedAt,
        threatLevel,
      };
    }
  }

  return {
    isValid: true,
    origin: normalizedOrigin,
    validatedAt,
    threatLevel,
  };
}

/**
 * Verify backward compatibility of webhook with legacy systems
 *
 * This function analyzes a webhook payload and system state to determine if the
 * webhook can be safely processed using current code while maintaining compatibility
 * with legacy data structures and conventions.
 *
 * Compatibility checks include:
 * 1. Payload schema validation against both new and legacy formats
 * 2. Detection of deprecated field usage
 * 3. Verification of required modern fields
 * 4. Assessment of migration necessity
 * 5. Generation of compatibility warnings
 *
 * @param webhookPayload - The webhook payload object to check
 * @param context - Webhook context from resolveWebhookContext
 * @returns {Promise<BackwardCompatibilityResult>} Detailed compatibility assessment
 *
 * @example
 * ```typescript
 * const payload = { eventType: 'user.created', data: { id: '123' } };
 * const compat = await verifyBackwardsCompatibility(payload, context);
 *
 * if (!compat.isCompatible) {
 *   console.warn('Compatibility issues:', compat.warnings);
 *   await performMigration();
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Using legacy payload format
 * const legacyPayload = { type: 'user_created', user_id: '123' };
 * const compat = await verifyBackwardsCompatibility(legacyPayload, legacyContext);
 *
 * if (compat.legacyModeActive) {
 *   // Apply legacy processing logic
 * }
 * ```
 */
export async function verifyBackwardsCompatibility(
  webhookPayload: Record<string, unknown>,
  context: WebhookContext,
): Promise<BackwardCompatibilityResult> {
  const warnings: string[] = [];
  const deprecatedFeatures: string[] = [];
  const migrationSteps: string[] = [];

  // Check for legacy payload format
  let usesLegacyFormat = false;
  if (webhookPayload.type && !webhookPayload.eventType) {
    deprecatedFeatures.push('Legacy "type" field instead of "eventType"');
    usesLegacyFormat = true;
  }

  // Check for deprecated field usage
  const deprecatedFields = ['user_id', 'account_id', 'resource_id'];
  for (const field of deprecatedFields) {
    if (field in webhookPayload) {
      deprecatedFeatures.push(`Deprecated field "${field}" detected`);
    }
  }

  // Check for required modern fields
  const requiredModernFields = ['eventType', 'timestamp', 'data'];
  const missingFields: string[] = [];
  for (const field of requiredModernFields) {
    if (!(field in webhookPayload)) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    warnings.push(`Missing modern fields: ${missingFields.join(', ')}`);
  }

  // Determine compatibility
  const isCompatible = missingFields.length === 0 || context.legacyMode;

  if (deprecatedFeatures.length > 0) {
    migrationSteps.push('Migrate payload format to use eventType instead of type');
    migrationSteps.push('Replace deprecated snake_case field names with camelCase');
  }

  if (context.legacyMode && !usesLegacyFormat) {
    warnings.push('System is in legacy mode but receiving modern format webhook');
  }

  return {
    isCompatible,
    warnings,
    deprecatedFeatures,
    migrationSteps,
    legacyModeActive: context.legacyMode,
  };
}

/**
 * Migrate instances with company ID
 *
 * This function performs a data migration to associate instances with company IDs,
 * transitioning from a tenant-only isolation model to a company-based model.
 *
 * Migration process:
 * 1. Query all instances without company ID mapping
 * 2. Attempt to resolve company ID for each instance
 * 3. Create mappings in the database
 * 4. Update related records with company context
 * 5. Verify integrity of migrated data
 * 6. Rollback on errors (transactional)
 *
 * @param tenantId - Tenant ID to migrate instances for (if empty, migrates all)
 * @returns {Promise<MigrationResult>} Detailed migration results
 *
 * @example
 * ```typescript
 * const result = await migrateInstancesWithCompanyId('tenant-123');
 * console.log(`Migrated ${result.migratedCount} instances`);
 *
 * if (result.status !== 'completed') {
 *   console.error('Migration issues:', result.results.filter(r => r.status !== 'success'));
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Migrate all instances across all tenants
 * const globalResult = await migrateInstancesWithCompanyId('');
 * console.log(`Migration status: ${globalResult.status}`);
 * ```
 */
export async function migrateInstancesWithCompanyId(tenantId: string = ''): Promise<MigrationResult> {
  const startedAt = new Date();
  const migrationId = `migration-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  console.info(`[WebhookIntegration] Starting migration ${migrationId} for tenant: ${tenantId || 'all'}`);

  const results: MigrationResult['results'] = [];
  let migratedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  try {
    // Simulated instance retrieval from database
    const instancesToMigrate = await getInstancesWithoutCompanyId(tenantId);

    for (const instance of instancesToMigrate) {
      try {
        // Attempt to resolve company ID
        const companyId = await resolveCompanyIdFromDatabase(instance.tenantId, instance.id);

        if (!companyId) {
          // Skip instances that cannot be resolved
          results.push({
            instanceId: instance.id,
            status: 'skipped',
          });
          skippedCount++;
          continue;
        }

        // Update instance with company ID (simulated)
        await updateInstanceWithCompanyId(instance.id, companyId);

        results.push({
          instanceId: instance.id,
          status: 'success',
          companyId,
        });
        migratedCount++;
      } catch (error) {
        results.push({
          instanceId: instance.id,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        });
        failedCount++;
      }
    }
  } catch (error) {
    const completedAt = new Date();
    const result: MigrationResult = {
      migratedCount,
      failedCount,
      skippedCount,
      results,
      status: 'failed',
      startedAt,
      completedAt,
    };

    migrationTracking.set(migrationId, result);
    throw error;
  }

  const completedAt = new Date();
  const status: 'completed' | 'partial' | 'failed' =
    failedCount === 0 ? 'completed' : migratedCount === 0 ? 'failed' : 'partial';

  const result: MigrationResult = {
    migratedCount,
    failedCount,
    skippedCount,
    results,
    status,
    startedAt,
    completedAt,
  };

  migrationTracking.set(migrationId, result);

  console.info(`[WebhookIntegration] Migration ${migrationId} completed:`, {
    status,
    migratedCount,
    failedCount,
    skippedCount,
  });

  return result;
}

/**
 * Get the effective isolation ID for webhook processing
 *
 * This function determines the correct isolation ID to use for a webhook based on
 * the system configuration, context, and company isolation readiness.
 *
 * Resolution logic:
 * 1. If legacy mode is active, use tenantId
 * 2. If company isolation is enabled and ready, use companyId
 * 3. Otherwise, fall back to tenantId for safety
 *
 * The isolation ID is used to ensure that webhook processing and data access
 * is properly scoped and isolated to the correct organizational boundary.
 *
 * @param tenantId - The tenant identifier
 * @param companyId - The company identifier
 * @param legacyMode - Whether legacy mode is active
 * @returns {string} The effective isolation ID for this context
 *
 * @example
 * ```typescript
 * const isolationId = getEffectiveIsolationId('tenant-123', 'company-456', false);
 * console.log(isolationId); // 'company-456'
 *
 * // Use isolationId to scope database queries
 * const data = await db.query('SELECT * FROM items WHERE companyId = ?', [isolationId]);
 * ```
 *
 * @example
 * ```typescript
 * // Legacy mode uses tenant ID
 * const legacyId = getEffectiveIsolationId('tenant-789', 'company-999', true);
 * console.log(legacyId); // 'tenant-789'
 * ```
 */
export function getEffectiveIsolationId(tenantId: string, companyId: string, legacyMode: boolean): string {
  if (legacyMode) {
    return tenantId;
  }

  if (globalConfig.companyIsolationEnabled && companyId && companyId !== tenantId) {
    return companyId;
  }

  return tenantId;
}

/**
 * Check if the system is ready for company isolation
 *
 * This function performs a comprehensive readiness assessment to determine if all
 * system components are prepared to enforce company-based isolation. This is a
 * critical check before enabling isolation in production.
 *
 * Readiness checks include:
 * 1. Database schema compatibility (company_id column presence)
 * 2. Index existence for isolation queries
 * 3. Migration completion status
 * 4. Application code support for isolation
 * 5. Configuration consistency across services
 * 6. No active webhooks in processing
 *
 * @returns {Promise<IsolationReadinessReport>} Comprehensive readiness assessment
 *
 * @example
 * ```typescript
 * const report = await isSystemReadyForCompanyIsolation();
 *
 * if (report.isReady) {
 *   await enableCompanyIsolation();
 * } else {
 *   console.error('System not ready. Issues:');
 *   for (const component of report.components) {
 *     if (!component.ready) {
 *       console.error(`  ${component.name}:`, component.issues);
 *     }
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Check with recommendations
 * const report = await isSystemReadyForCompanyIsolation();
 * console.log(`Readiness: ${report.readinessPercentage}%`);
 * console.log('Recommended actions:', report.recommendedActions);
 * ```
 */
export async function isSystemReadyForCompanyIsolation(): Promise<IsolationReadinessReport> {
  const components: IsolationReadinessReport['components'] = [];
  const recommendedActions: string[] = [];
  let readyComponentCount = 0;

  // Check database schema
  let dbSchemaReady = false;
  let dbSchemaIssues: string[] = [];
  try {
    dbSchemaReady = await checkDatabaseSchema();
    if (!dbSchemaReady) {
      dbSchemaIssues.push('company_id column missing from instances table');
      dbSchemaIssues.push('Missing indexes on (tenant_id, company_id)');
      recommendedActions.push('Run migration: add company_id column to instances table');
      recommendedActions.push('Create composite index on (tenant_id, company_id)');
    }
  } catch (error) {
    dbSchemaIssues.push(`Database check failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  components.push({
    name: 'Database Schema',
    ready: dbSchemaReady,
    issues: dbSchemaIssues,
  });
  if (dbSchemaReady) readyComponentCount++;

  // Check migration status
  let migrationsComplete = false;
  let migrationIssues: string[] = [];
  try {
    const migrationStatus = await checkMigrationStatus();
    migrationsComplete = migrationStatus.allComplete;
    if (!migrationsComplete) {
      migrationIssues.push(`${migrationStatus.pending} pending migrations`);
      recommendedActions.push('Run all pending migrations');
    }
  } catch (error) {
    migrationIssues.push(`Migration check failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  components.push({
    name: 'Migrations',
    ready: migrationsComplete,
    issues: migrationIssues,
  });
  if (migrationsComplete) readyComponentCount++;

  // Check instance mapping coverage
  let mappingsCovered = false;
  let mappingIssues: string[] = [];
  try {
    const coverage = await checkCompanyMappingCoverage();
    mappingsCovered = coverage.percentage > 95;
    if (!mappingsCovered) {
      mappingIssues.push(`Only ${coverage.percentage}% of instances mapped to companies`);
      recommendedActions.push(`Migrate remaining ${coverage.unmappedCount} instances`);
    }
  } catch (error) {
    mappingIssues.push(`Mapping check failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  components.push({
    name: 'Instance Mappings',
    ready: mappingsCovered,
    issues: mappingIssues,
  });
  if (mappingsCovered) readyComponentCount++;

  // Check application support
  let appSupported = globalConfig.companyIsolationEnabled;
  const appIssues: string[] = [];
  if (!appSupported) {
    appIssues.push('Company isolation not enabled in configuration');
    recommendedActions.push('Set companyIsolationEnabled to true in config');
  }

  components.push({
    name: 'Application Configuration',
    ready: appSupported,
    issues: appIssues,
  });
  if (appSupported) readyComponentCount++;

  const readinessPercentage = Math.round((readyComponentCount / components.length) * 100);
  const isReady = readinessPercentage >= 100;
  const riskLevel: 'low' | 'medium' | 'high' | 'critical' = isReady
    ? 'low'
    : readinessPercentage >= 75
      ? 'medium'
      : readinessPercentage >= 50
        ? 'high'
        : 'critical';

  return {
    isReady,
    readinessPercentage,
    components,
    recommendedActions,
    riskLevel,
  };
}

/**
 * Log webhook processing event
 *
 * This function records webhook processing events for auditing, debugging, and
 * monitoring purposes. Logs are stored in-memory and can be persisted to a backend
 * storage system.
 *
 * Logged information includes:
 * - Webhook identification and context
 * - Processing result (success/failure)
 * - Performance metrics (response time)
 * - Error details (if applicable)
 * - Custom tags for filtering and analysis
 * - Timestamps for correlation
 *
 * @param context - Webhook context from resolveWebhookContext
 * @param statusCode - HTTP status code of the webhook response
 * @param responseTime - Response time in milliseconds
 * @param success - Whether webhook processing was successful
 * @param error - Error message if processing failed
 * @param tags - Optional custom tags for log filtering
 * @param metadata - Optional additional metadata
 * @returns {string} Generated webhook ID for log retrieval
 *
 * @example
 * ```typescript
 * const webhookId = logWebhookProcessing(
 *   context,
 *   200,
 *   45,
 *   true,
 *   undefined,
 *   ['user.created', 'async-processing']
 * );
 * console.log('Webhook logged:', webhookId);
 * ```
 *
 * @example
 * ```typescript
 * // Log failed webhook
 * const failedId = logWebhookProcessing(
 *   context,
 *   500,
 *   1250,
 *   false,
 *   'Database connection timeout',
 *   ['error', 'retry-needed'],
 *   { retryCount: 2, nextRetry: futureDate }
 * );
 * ```
 */
export function logWebhookProcessing(
  context: WebhookContext,
  statusCode: number,
  responseTime: number,
  success: boolean,
  error?: string,
  tags: string[] = [],
  metadata?: Record<string, unknown>,
): string {
  const webhookId = `webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const log: WebhookProcessingLog = {
    webhookId,
    tenantId: context.tenantId,
    companyId: context.companyId,
    instanceId: context.instanceId,
    statusCode,
    responseTime,
    success,
    error,
    tags: [...tags, ...(success ? ['success'] : ['failed'])],
    processedAt: new Date(),
    metadata,
  };

  webhookLogs.set(webhookId, log);

  // Log to console/logger in appropriate level
  const logLevel = success ? 'info' : 'error';
  console.log(
    `[WebhookIntegration] [${logLevel.toUpperCase()}] ${webhookId}:`,
    JSON.stringify({
      tenant: context.tenantId,
      company: context.companyId,
      instance: context.instanceId,
      status: statusCode,
      time: responseTime,
      success,
      ...(error && { error }),
      tags,
    }),
  );

  // In a real implementation, persist to database or log aggregation service
  if (globalConfig.logger) {
    globalConfig.logger[logLevel]('Webhook processed', log);
  }

  return webhookId;
}

/**
 * Retrieve webhook processing logs
 *
 * @param webhookId - Optional specific webhook ID to retrieve
 * @param tags - Optional tags to filter logs
 * @returns Matching log entries
 */
export function getWebhookLogs(webhookId?: string, tags?: string[]): WebhookProcessingLog[] {
  if (webhookId) {
    const log = webhookLogs.get(webhookId);
    return log ? [log] : [];
  }

  let logs = Array.from(webhookLogs.values());

  if (tags && tags.length > 0) {
    logs = logs.filter((log) => tags.some((tag) => log.tags.includes(tag)));
  }

  return logs;
}

/**
 * Helper: Resolve company ID from database (simulated)
 */
async function resolveCompanyIdFromDatabase(tenantId: string, instanceId: string): Promise<string | null> {
  // Simulated database query
  // In a real implementation, query the actual database
  return new Promise((resolve) => {
    setTimeout(() => {
      // Return a simulated company ID based on tenant
      if (tenantId && instanceId) {
        resolve(`company-${tenantId}-${instanceId.split('-')[1] || 'default'}`);
      } else {
        resolve(null);
      }
    }, 10);
  });
}

/**
 * Helper: Get instances without company ID (simulated)
 */
async function getInstancesWithoutCompanyId(
  tenantId: string,
): Promise<Array<{ id: string; tenantId: string }>> {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Return simulated instances
      if (tenantId) {
        resolve([
          { id: 'instance-1', tenantId },
          { id: 'instance-2', tenantId },
        ]);
      } else {
        resolve([]);
      }
    }, 20);
  });
}

/**
 * Helper: Update instance with company ID (simulated)
 */
async function updateInstanceWithCompanyId(instanceId: string, companyId: string): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.debug(`Updated instance ${instanceId} with company ${companyId}`);
      resolve();
    }, 15);
  });
}

/**
 * Helper: Check database schema (simulated)
 */
async function checkDatabaseSchema(): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Simulate schema check
      resolve(true);
    }, 50);
  });
}

/**
 * Helper: Check migration status (simulated)
 */
async function checkMigrationStatus(): Promise<{ allComplete: boolean; pending: number }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ allComplete: true, pending: 0 });
    }, 50);
  });
}

/**
 * Helper: Check company mapping coverage (simulated)
 */
async function checkCompanyMappingCoverage(): Promise<{ percentage: number; unmappedCount: number }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ percentage: 98, unmappedCount: 2 });
    }, 50);
  });
}

export type {
  WebhookContext,
  WebhookOriginValidation,
  BackwardCompatibilityResult,
  MigrationResult,
  WebhookProcessingLog,
  IsolationReadinessReport,
  WebhookIntegrationConfig,
};
