import { createSupabaseServerClient } from './supabase';
import { sendMessage } from './z-api-sender';

/**
 * Condition types for rule evaluation
 */
export type ConditionType = 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'regex';

/**
 * Condition structure for rule matching
 */
export interface RuleCondition {
  type: ConditionType;
  field: string;
  value: string;
  caseSensitive?: boolean;
}

/**
 * Message rule structure stored in database
 */
export interface MessageRule {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  conditions: RuleCondition[];
  response_template: string;
  priority: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Message structure for rule evaluation
 */
export interface Message {
  content: string;
  sender: string;
  senderPhone?: string;
  senderName?: string;
  messageType?: string;
  [key: string]: any;
}

/**
 * Conversation structure for context
 */
export interface Conversation {
  id: string;
  tenant_id: string;
  phone: string;
  [key: string]: any;
}

/**
 * Evaluates a single condition against a message
 * Supports: contains, equals, startsWith, endsWith, regex
 *
 * @param message - The message object to evaluate
 * @param condition - The condition to check
 * @returns true if condition matches, false otherwise
 */
function evaluateCondition(message: Message, condition: RuleCondition): boolean {
  const fieldValue = message[condition.field];

  if (fieldValue === undefined || fieldValue === null) {
    return false;
  }

  const strValue = String(fieldValue);
  const conditionValue = condition.value;
  const caseSensitive = condition.caseSensitive !== false; // default to case-sensitive

  // Normalize values for case-insensitive comparison
  const normalizedStrValue = caseSensitive ? strValue : strValue.toLowerCase();
  const normalizedCondValue = caseSensitive ? conditionValue : conditionValue.toLowerCase();

  switch (condition.type) {
    case 'contains':
      return normalizedStrValue.includes(normalizedCondValue);

    case 'equals':
      return normalizedStrValue === normalizedCondValue;

    case 'startsWith':
      return normalizedStrValue.startsWith(normalizedCondValue);

    case 'endsWith':
      return normalizedStrValue.endsWith(normalizedCondValue);

    case 'regex': {
      try {
        const flags = caseSensitive ? 'g' : 'gi';
        const regex = new RegExp(conditionValue, flags);
        return regex.test(normalizedStrValue);
      } catch (error) {
        console.error(`Invalid regex pattern: ${conditionValue}`, error);
        return false;
      }
    }

    default:
      return false;
  }
}

/**
 * Evaluates all conditions for a rule (AND logic - all must match)
 *
 * @param message - The message object to evaluate
 * @param conditions - Array of conditions that all must match
 * @returns true if all conditions match, false otherwise
 */
function evaluateAllConditions(message: Message, conditions: RuleCondition[]): boolean {
  if (!conditions || conditions.length === 0) {
    return false;
  }

  return conditions.every(condition => evaluateCondition(message, condition));
}

/**
 * Evaluates a set of rules against a message and returns matching rules
 * Rules are sorted by priority (higher priority first)
 *
 * @param message - The message to evaluate
 * @param rules - Array of rules to evaluate
 * @returns Array of matching rules sorted by priority (descending)
 */
export function evaluateRules(message: Message, rules: MessageRule[]): MessageRule[] {
  if (!rules || rules.length === 0) {
    return [];
  }

  const matchingRules = rules.filter(rule => {
    // Only evaluate active rules
    if (!rule.active) {
      return false;
    }

    // Evaluate all conditions for this rule
    return evaluateAllConditions(message, rule.conditions);
  });

  // Sort by priority descending (higher priority first)
  return matchingRules.sort((a, b) => b.priority - a.priority);
}

/**
 * Triggers message rules for a conversation
 * Fetches active rules for tenant, evaluates them, and triggers responses
 *
 * @param conversation - The conversation context
 * @param message - The incoming message
 * @param tenantId - The tenant ID
 * @param instanceId - Optional Z-API instance ID for sending messages
 * @param zApiToken - Optional Z-API token for sending messages
 */
export async function triggerMessageRules(
  conversation: Conversation,
  message: Message,
  tenantId: string,
  instanceId?: string,
  zApiToken?: string
): Promise<void> {
  try {
    const supabase = createSupabaseServerClient();

    // Fetch active rules for this tenant
    const { data: rules, error: rulesError } = await supabase
      .from('message_rules')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('active', true);

    if (rulesError) {
      console.error('Error fetching message rules:', rulesError);
      return;
    }

    if (!rules || rules.length === 0) {
      console.log('No active rules found for tenant:', tenantId);
      return;
    }

    // Parse conditions from JSONB if they're stored as strings
    const parsedRules: MessageRule[] = rules.map(rule => ({
      ...rule,
      conditions: typeof rule.conditions === 'string'
        ? JSON.parse(rule.conditions)
        : rule.conditions,
    }));

    // Evaluate rules against the message
    const matchingRules = evaluateRules(message, parsedRules);

    if (matchingRules.length === 0) {
      console.log('No matching rules found for message');
      return;
    }

    // Log matching rules for debugging
    console.log(`Found ${matchingRules.length} matching rule(s) for message`);

    // Trigger response for each matching rule
    for (const rule of matchingRules) {
      try {
        await triggerRuleResponse(conversation, rule, message, tenantId, instanceId, zApiToken);
      } catch (error) {
        console.error(`Error triggering rule ${rule.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in triggerMessageRules:', error);
  }
}

/**
 * Executes the response action for a matched rule
 * This function handles sending the response message
 *
 * @param conversation - The conversation context
 * @param rule - The matched rule
 * @param message - The original message
 * @param tenantId - The tenant ID
 * @param instanceId - Optional Z-API instance ID
 * @param zApiToken - Optional Z-API token
 */
async function triggerRuleResponse(
  conversation: Conversation,
  rule: MessageRule,
  message: Message,
  tenantId: string,
  instanceId?: string,
  zApiToken?: string
): Promise<void> {
  try {
    const supabase = createSupabaseServerClient();

    // Prepare response message with template substitution
    const responseContent = prepareResponseTemplate(
      rule.response_template,
      message,
      conversation
    );

    // Store the automated response in the database
    const { error: insertError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        content: responseContent,
        direction: 'outbound',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('Error storing automated response:', insertError);
      return;
    }

    // Log the triggered response
    console.log(`Rule "${rule.name}" triggered for conversation ${conversation.id}`);

    // Send the message via Z-API if credentials are available
    if (instanceId && zApiToken && conversation.id) {
      try {
        const result = await sendMessage(
          tenantId,
          instanceId,
          conversation.id,
          responseContent,
          zApiToken
        );

        if (result.success) {
          console.log(`Message sent successfully for rule "${rule.name}"`, {
            conversationId: conversation.id,
            messageId: result.messageId,
          });
        } else {
          console.error(`Failed to send message for rule "${rule.name}"`, {
            error: result.error,
            conversationId: conversation.id,
          });
        }
      } catch (sendError) {
        console.error(`Error sending message for rule "${rule.name}":`, sendError);
      }
    } else {
      console.log(`Z-API credentials not available for rule "${rule.name}", message stored in database only`);
    }
  } catch (error) {
    console.error('Error triggering rule response:', error);
  }
}

/**
 * Prepares the response template by substituting variables
 * Supports both {variable} and {{variable}} syntax
 * Available variables: name, phone, date, sender, senderPhone, content, messageType, conversationId, timestamp, time
 *
 * @param template - The response template string
 * @param message - The message for context
 * @param conversation - The conversation for context
 * @returns The prepared response content
 */
function prepareResponseTemplate(
  template: string,
  message: Message,
  conversation: Conversation
): string {
  let response = template;

  // Define available variables for substitution
  const variables: Record<string, any> = {
    name: message.senderName || message.sender || 'User',
    sender: message.sender || message.senderName || 'User',
    phone: conversation.phone || message.senderPhone || '',
    senderPhone: message.senderPhone || '',
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString(),
    content: message.content || '',
    messageType: message.messageType || '',
    conversationId: conversation.id || '',
    timestamp: new Date().toISOString(),
  };

  // Replace template variables with {variable} syntax (task requirement)
  Object.entries(variables).forEach(([key, value]) => {
    const singleBracePlaceholder = new RegExp(`{${key}}`, 'g');
    response = response.replace(singleBracePlaceholder, String(value));
  });

  // Also support {{variable}} syntax for backward compatibility
  Object.entries(variables).forEach(([key, value]) => {
    const doubleBracePlaceholder = new RegExp(`{{${key}}}`, 'g');
    response = response.replace(doubleBracePlaceholder, String(value));
  });

  return response;
}

/**
 * Validates a rule condition structure
 * Ensures all required fields are present and valid
 *
 * @param condition - The condition to validate
 * @returns true if valid, false otherwise
 */
export function validateRuleCondition(condition: any): boolean {
  if (!condition || typeof condition !== 'object') {
    return false;
  }

  const validTypes: ConditionType[] = ['contains', 'equals', 'startsWith', 'endsWith', 'regex'];

  return (
    typeof condition.type === 'string' &&
    validTypes.includes(condition.type) &&
    typeof condition.field === 'string' &&
    condition.field.length > 0 &&
    typeof condition.value === 'string' &&
    (typeof condition.caseSensitive === 'boolean' || condition.caseSensitive === undefined)
  );
}

/**
 * Validates a complete rule structure
 * Ensures rule and all its conditions are valid
 *
 * @param rule - The rule to validate
 * @returns Object with validation result and any error messages
 */
export function validateRule(rule: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!rule || typeof rule !== 'object') {
    return { valid: false, errors: ['Rule must be an object'] };
  }

  if (!rule.name || typeof rule.name !== 'string') {
    errors.push('Rule must have a name (string)');
  }

  if (!Array.isArray(rule.conditions) || rule.conditions.length === 0) {
    errors.push('Rule must have at least one condition');
  } else {
    rule.conditions.forEach((condition: any, index: number) => {
      if (!validateRuleCondition(condition)) {
        errors.push(`Condition ${index} is invalid`);
      }
    });
  }

  if (!rule.response_template || typeof rule.response_template !== 'string') {
    errors.push('Rule must have a response_template (string)');
  }

  if (typeof rule.priority !== 'number' || rule.priority < 0) {
    errors.push('Rule priority must be a non-negative number');
  }

  if (typeof rule.active !== 'boolean') {
    errors.push('Rule active status must be a boolean');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
