import type { NapcatConfig, UserConfig, RulesConfig, AIConfig, RobotConfig, CreditTier, FloodConfig, SeverityConfig, ImageBlacklistConfig, WhitelistBlacklistConfig, AIProvider, CharacterProfile, HelperConfig } from './config.js';
import type { PenaltyType } from '../db/entities/Violation.js';
import { logger } from '../logger.js';

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateConfig(config: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config) {
    errors.push('配置为空');
    return { valid: false, errors, warnings };
  }

  validateNapcatConfig(config.napcat, errors, warnings);
  validateUserConfig(config.user, errors, warnings);
  validateRulesConfig(config.rules, errors, warnings);
  validateAIConfig(config.ai, errors, warnings);
  validateRobotConfig(config.robot, errors, warnings);
  validateDebugConfig(config.debug, errors, warnings);
  validateHelperConfig(config.helper, errors, warnings);

  if (config.deployer !== undefined && typeof config.deployer !== 'number') {
    errors.push('deployer 必须是数字');
  }

  if (config.enable_commands !== undefined && typeof config.enable_commands !== 'boolean') {
    errors.push('enable_commands 必须是布尔值');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function validateNapcatConfig(napcat: any, errors: string[], warnings: string[]): void {
  if (!napcat) {
    errors.push('缺少 napcat 配置');
    return;
  }

  if (typeof napcat.protocol !== 'string' || !['ws', 'wss'].includes(napcat.protocol)) {
    errors.push('napcat.protocol 必须是 "ws" 或 "wss"');
  }

  if (typeof napcat.host !== 'string') {
    errors.push('napcat.host 必须是字符串');
  }

  if (typeof napcat.port !== 'number' || napcat.port < 1 || napcat.port > 65535) {
    errors.push('napcat.port 必须是 1-65535 之间的数字');
  }

  if (typeof napcat.accessToken !== 'string') {
    errors.push('napcat.accessToken 必须是字符串');
  }

  if (typeof napcat.throwPromise !== 'boolean') {
    errors.push('napcat.throwPromise 必须是布尔值');
  }

  if (typeof napcat.debug !== 'boolean') {
    errors.push('napcat.debug 必须是布尔值');
  }

  if (napcat.reconnection) {
    if (typeof napcat.reconnection.enable !== 'boolean') {
      errors.push('napcat.reconnection.enable 必须是布尔值');
    }
    if (typeof napcat.reconnection.attempts !== 'number' || napcat.reconnection.attempts < 1) {
      errors.push('napcat.reconnection.attempts 必须是大于0的数字');
    }
    if (typeof napcat.reconnection.delay !== 'number' || napcat.reconnection.delay < 0) {
      errors.push('napcat.reconnection.delay 必须是非负数');
    }
  }
}

function validateUserConfig(user: any, errors: string[], warnings: string[]): void {
  if (!user) {
    errors.push('缺少 user 配置');
    return;
  }

  if (!user.credit) {
    errors.push('缺少 user.credit 配置');
    return;
  }

  if (typeof user.credit.default !== 'number') {
    errors.push('user.credit.default 必须是数字');
  }

  if (typeof user.credit.max !== 'number') {
    errors.push('user.credit.max 必须是数字');
  }

  if (typeof user.credit.kick_threshold !== 'number') {
    errors.push('user.credit.kick_threshold 必须是数字');
  }

  if (user.credit.like_award !== undefined && typeof user.credit.like_award !== 'number') {
    errors.push('user.credit.like_award 必须是数字');
  }

  if (user.credit.dislike_penalty !== undefined && typeof user.credit.dislike_penalty !== 'number') {
    errors.push('user.credit.dislike_penalty 必须是数字');
  }

  if (user.credit.max_daily_interactions !== undefined && typeof user.credit.max_daily_interactions !== 'number') {
    errors.push('user.credit.max_daily_interactions 必须是数字');
  }

  if (user.credit.tiers) {
    if (!Array.isArray(user.credit.tiers)) {
      errors.push('user.credit.tiers 必须是数组');
    } else {
      user.credit.tiers.forEach((tier: any, index: number) => {
        if (typeof tier.min_credit !== 'number') {
          errors.push(`user.credit.tiers[${index}].min_credit 必须是数字`);
        }
        if (typeof tier.max_credit !== 'number') {
          errors.push(`user.credit.tiers[${index}].max_credit 必须是数字`);
        }
        if (typeof tier.dc_multiplier !== 'number') {
          errors.push(`user.credit.tiers[${index}].dc_multiplier 必须是数字`);
        }
        if (typeof tier.mute_multiplier !== 'number') {
          errors.push(`user.credit.tiers[${index}].mute_multiplier 必须是数字`);
        }
        if (tier.checkin_award !== undefined && typeof tier.checkin_award !== 'number') {
          errors.push(`user.credit.tiers[${index}].checkin_award 必须是数字`);
        }
        if (tier.min_credit !== undefined && tier.max_credit !== undefined && tier.min_credit > tier.max_credit) {
          warnings.push(`user.credit.tiers[${index}].min_credit 大于 max_credit`);
        }
      });
    }
  }
}

function validateRulesConfig(rules: any, errors: string[], warnings: string[]): void {
  if (!rules) {
    warnings.push('缺少 rules 配置');
    return;
  }

  if (rules.whitelistBlacklist) {
    validateWhitelistBlacklistConfig(rules.whitelistBlacklist, errors, warnings);
  }

  if (rules.general) {
    validateGeneralConfig(rules.general, errors, warnings);
  }

  if (rules.moderation) {
    validateModerationConfig(rules.moderation, errors, warnings);
  }

  if (rules.imageBlacklist) {
    validateImageBlacklistConfig(rules.imageBlacklist, errors, warnings);
  }

  if (rules.humanVerification) {
    validateHumanVerificationConfig(rules.humanVerification, errors, warnings);
  }

  if (rules.sensitive) {
    validateSensitiveConfig(rules.sensitive, errors, warnings);
  }
}

function validateHumanVerificationConfig(config: any, errors: string[], warnings: string[]): void {
  if (typeof config.enabled !== 'boolean') {
    errors.push('rules.humanVerification.enabled 必须是布尔值');
  }

  if (typeof config.maxnum !== 'number' || config.maxnum < 1) {
    errors.push('rules.humanVerification.maxnum 必须是大于0的数字');
  }
}

function validateSensitiveConfig(config: any, errors: string[], warnings: string[]): void {
  if (typeof config.enabled !== 'boolean') {
    errors.push('rules.sensitive.enabled 必须是布尔值');
  }

  if (config.penalties) {
    if (!Array.isArray(config.penalties)) {
      errors.push('rules.sensitive.penalties 必须是数组');
    } else {
      config.penalties.forEach((penalty: any, index: number) => {
        if (typeof penalty.severity !== 'number') {
          errors.push(`rules.sensitive.penalties[${index}].severity 必须是数字`);
        }
        validatePenalty(penalty.penalty, `rules.sensitive.penalties[${index}].penalty`, errors);
      });
    }
  }
}



function validateWhitelistBlacklistConfig(config: any, errors: string[], warnings: string[]): void {
  if (typeof config.enabled !== 'boolean') {
    errors.push('rules.whitelistBlacklist.enabled 必须是布尔值');
  }

  if (!['whitelist', 'blacklist'].includes(config.mode)) {
    errors.push('rules.whitelistBlacklist.mode 必须是 "whitelist" 或 "blacklist"');
  }

  if (!Array.isArray(config.groups)) {
    errors.push('rules.whitelistBlacklist.groups 必须是数组');
  } else {
    config.groups.forEach((group: any, index: number) => {
      if (typeof group !== 'number') {
        errors.push(`rules.whitelistBlacklist.groups[${index}] 必须是数字`);
      }
    });
  }

  if (!Array.isArray(config.users)) {
    errors.push('rules.whitelistBlacklist.users 必须是数组');
  } else {
    config.users.forEach((user: any, index: number) => {
      if (typeof user !== 'number') {
        errors.push(`rules.whitelistBlacklist.users[${index}] 必须是数字`);
      }
    });
  }
}

function validateGeneralConfig(config: any, errors: string[], warnings: string[]): void {
  if (config.flood) {
    if (!Array.isArray(config.flood)) {
      errors.push('rules.general.flood 必须是数组');
    } else {
      config.flood.forEach((flood: any, index: number) => {
        if (typeof flood.windowSize !== 'number' || flood.windowSize < 1) {
          errors.push(`rules.general.flood[${index}].windowSize 必须是大于0的数字`);
        }
        if (typeof flood.maxMessages !== 'number' || flood.maxMessages < 0) {
          errors.push(`rules.general.flood[${index}].maxMessages 必须是非负数`);
        }
        if (typeof flood.maxLength !== 'number' || flood.maxLength < 0) {
          errors.push(`rules.general.flood[${index}].maxLength 必须是非负数`);
        }
        validatePenalty(flood.penalty, `rules.general.flood[${index}].penalty`, errors);
      });
    }

    if (config.too_long_amount_to !== undefined && typeof config.too_long_amount_to !== 'number') {
      errors.push('rules.general.too_long_amount_to 必须是数字');
    }

    if (config.identical_amount_to !== undefined && typeof config.identical_amount_to !== 'number') {
      errors.push('rules.general.identical_amount_to 必须是数字');
    }

    if (config.bot_call_amount_to !== undefined && typeof config.bot_call_amount_to !== 'number') {
      errors.push('rules.general.bot_call_amount_to 必须是数字');
    }
  }
}

function validateModerationConfig(config: any, errors: string[], warnings: string[]): void {
  if (typeof config.enabled !== 'boolean') {
    errors.push('rules.moderation.enabled 必须是布尔值');
  }

  if (typeof config.pool_size !== 'number' || config.pool_size < 1) {
    errors.push('rules.moderation.pool_size 必须是大于0的数字');
  }

  if (typeof config.max_await_time !== 'number' || config.max_await_time < 0) {
    errors.push('rules.moderation.max_await_time 必须是非负数');
  }

  if (config.penalties) {
    if (!Array.isArray(config.penalties)) {
      errors.push('rules.moderation.penalties 必须是数组');
    } else {
      config.penalties.forEach((penalty: any, index: number) => {
        if (typeof penalty.severity !== 'number') {
          errors.push(`rules.moderation.penalties[${index}].severity 必须是数字`);
        }
        validatePenalty(penalty.penalty, `rules.moderation.penalties[${index}].penalty`, errors);
      });
    }
  }
}

function validateImageBlacklistConfig(config: any, errors: string[], warnings: string[]): void {
  if (typeof config.enabled !== 'boolean') {
    errors.push('rules.imageBlacklist.enabled 必须是布尔值');
  }

  if (typeof config.hammingDistanceThreshold !== 'number' || config.hammingDistanceThreshold < 0) {
    errors.push('rules.imageBlacklist.hammingDistanceThreshold 必须是非负数');
  }

  validatePenalty(config.penalty, 'rules.imageBlacklist.penalty', errors);
}

function validatePenalty(penalty: any, path: string, errors: string[]): void {
  if (!penalty) {
    errors.push(`${path} 不能为空`);
    return;
  }

  const validPenaltyTypes: string[] = ['warning', 'mute', 'credit_deduction', 'other'];
  if (!validPenaltyTypes.includes(penalty.penalty_type)) {
    errors.push(`${path}.penalty_type 必须是 ${validPenaltyTypes.join(', ')} 之一`);
  }

  if (penalty.severity !== undefined && typeof penalty.severity !== 'number') {
    errors.push(`${path}.severity 必须是数字`);
  }

  if (penalty.credit_deduction !== undefined && typeof penalty.credit_deduction !== 'number') {
    errors.push(`${path}.credit_deduction 必须是数字`);
  }

  if (penalty.penalty_time !== undefined && typeof penalty.penalty_time !== 'number') {
    errors.push(`${path}.penalty_time 必须是数字`);
  }
}

function validateAIConfig(ai: any, errors: string[], warnings: string[]): void {
  if (!ai) {
    errors.push('缺少 ai 配置');
    return;
  }

  if (typeof ai.enable !== 'boolean') {
    errors.push('ai.enable 必须是布尔值');
  }

  if (!Array.isArray(ai.providers)) {
    errors.push('ai.providers 必须是数组');
  } else {
    ai.providers.forEach((provider: any, index: number) => {
      if (typeof provider.name !== 'string') {
        errors.push(`ai.providers[${index}].name 必须是字符串`);
      }
      if (typeof provider.apiKey !== 'string') {
        errors.push(`ai.providers[${index}].apiKey 必须是字符串`);
      }
      if (typeof provider.baseURL !== 'string') {
        errors.push(`ai.providers[${index}].baseURL 必须是字符串`);
      }
      if (typeof provider.model !== 'string') {
        errors.push(`ai.providers[${index}].model 必须是字符串`);
      }
      if (typeof provider.enable !== 'boolean') {
        errors.push(`ai.providers[${index}].enable 必须是布尔值`);
      }
    });
  }

  if (!Array.isArray(ai.chat_use_provider)) {
    errors.push('ai.chat_use_provider 必须是数组');
  }

  if (!Array.isArray(ai.moderation_use_provider)) {
    errors.push('ai.moderation_use_provider 必须是数组');
  }

  if (ai.profiles) {
    Object.entries(ai.profiles).forEach(([key, profile]: [string, any]) => {
      if (!profile.name || typeof profile.name !== 'string') {
        errors.push(`ai.profiles.${key}.name 必须是字符串`);
      }
      if (!profile.prompt || typeof profile.prompt !== 'object') {
        errors.push(`ai.profiles.${key}.prompt 必须是对象`);
      } else {
        if (typeof profile.prompt.personality !== 'string') {
          errors.push(`ai.profiles.${key}.prompt.personality 必须是字符串`);
        }
        if (typeof profile.prompt.reply_style !== 'string') {
          errors.push(`ai.profiles.${key}.prompt.reply_style 必须是字符串`);
        }
        if (typeof profile.prompt.on_remind_recall_forward !== 'string') {
          errors.push(`ai.profiles.${key}.prompt.on_remind_recall_forward 必须是字符串`);
        }
        if (typeof profile.prompt.on_remind_flood !== 'string') {
          errors.push(`ai.profiles.${key}.prompt.on_remind_flood 必须是字符串`);
        }
        if (typeof profile.prompt.on_remind_violation !== 'string') {
          errors.push(`ai.profiles.${key}.prompt.on_remind_violation 必须是字符串`);
        }
      }
    });
  }

  if (ai.activeProfile && typeof ai.activeProfile !== 'string') {
    errors.push('ai.activeProfile 必须是字符串');
  }

  if (typeof ai.reject_prompt_injection !== 'string') {
    errors.push('ai.reject_prompt_injection 必须是字符串');
  }
}

function validateRobotConfig(robot: any, errors: string[], warnings: string[]): void {
  if (!robot) {
    warnings.push('缺少 robot 配置');
    return;
  }

  if (typeof robot.include_official_robot !== 'boolean') {
    errors.push('robot.include_official_robot 必须是布尔值');
  }

  if (!Array.isArray(robot.custom_robots)) {
    errors.push('robot.custom_robots 必须是数组');
  } else {
    robot.custom_robots.forEach((id: any, index: number) => {
      if (typeof id !== 'number') {
        errors.push(`robot.custom_robots[${index}] 必须是数字`);
      }
    });
  }
}

function validateDebugConfig(debug: any, errors: string[], warnings: string[]): void {
  if (!debug) {
    warnings.push('缺少 debug 配置');
    return;
  }

  if (typeof debug.enable_tools !== 'boolean') {
    errors.push('debug.enable_tools 必须是布尔值');
  }

  if (typeof debug.test_groupid !== 'number') {
    errors.push('debug.test_groupid 必须是数字');
  }
}

function validateHelperConfig(helper: any, errors: string[], warnings: string[]): void {
  if (!helper) {
    warnings.push('缺少 helper 配置');
    return;
  }

  if (typeof helper.admins_group !== 'number') {
    errors.push('helper.admins_group 必须是数字');
  }

  if (!helper.recall_preventer) {
    warnings.push('缺少 helper.recall_preventer 配置');
    return;
  }

  if (typeof helper.recall_preventer.enabled !== 'boolean') {
    errors.push('helper.recall_preventer.enabled 必须是布尔值');
  }
}

export function logValidationResult(result: ValidationResult): string {
  const lines: string[] = [];
  
  if (result.valid) {
    lines.push('✅ 配置验证通过');
    if (result.warnings.length > 0) {
      lines.push('⚠️ 配置警告:');
      result.warnings.forEach(warning => lines.push(`  - ${warning}`));
    }
  } else {
    lines.push('❌ 配置验证失败:');
    result.errors.forEach(error => lines.push(`  - ${error}`));
    if (result.warnings.length > 0) {
      lines.push('⚠️ 配置警告:');
      result.warnings.forEach(warning => lines.push(`  - ${warning}`));
    }
  }
  
  const output = lines.join('\n');
  
  // 同时输出到日志
  if (result.valid) {
    logger.log(lines[0]);
    if (result.warnings.length > 0) {
      logger.warn('⚠️ 配置警告:');
      result.warnings.forEach(warning => logger.warn(`  - ${warning}`));
    }
  } else {
    logger.error('❌ 配置验证失败:');
    result.errors.forEach(error => logger.error(`  - ${error}`));
    if (result.warnings.length > 0) {
      logger.warn('⚠️ 配置警告:');
      result.warnings.forEach(warning => logger.warn(`  - ${warning}`));
    }
  }
  
  return output;
}