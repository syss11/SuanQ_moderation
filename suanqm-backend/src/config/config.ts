import { PenaltyType } from "../db/entities/Violation.js";

// 配置类型定义
export default interface AppConfig {
  deployer?:number;
  enable_commands: boolean;
  debug: {
    enable_tools: boolean;
    test_groupid: number;
  }
  // Napcat 配置
  napcat: NapcatConfig;
  // 用户配置
  user: UserConfig;
  // 规则配置
  rules: RulesConfig;
  // AI 角色配置
  ai: AIConfig;
  // 机器人配置
  robot: RobotConfig;
  // 辅助功能配置
  helper?: HelperConfig;
  // 图片清理配置
  image_cleanup?: ImageCleanupConfig;

}


// Napcat 配置类型定义
export interface NapcatConfig {
  protocol: 'ws' | 'wss';
  host: string;
  port: number;
  accessToken: string;
  throwPromise: boolean;
  reconnection: {
    enable: boolean;
    attempts: number;
    delay: number;
  };
  debug: boolean;
}

// 用户配置类型定义
export interface UserConfig {
  credit: {
    default: number;
    max: number;
    kick_threshold: number;
    like_award?: number;
    dislike_penalty?: number;
    max_daily_interactions?: number;
    tiers?: CreditTier[];
  };
}

export interface CreditTier {
  min_credit: number;
  max_credit: number;
  dc_multiplier: number;
  mute_multiplier: number;
  checkin_award?: number;
}

// 规则配置类型定义
export interface RulesConfig {
  general: GeneralConfig;
  moderation: ModerationConfig;
  whitelistBlacklist: WhitelistBlacklistConfig;
  imageBlacklist: ImageBlacklistConfig;
  humanVerification: HumanVerificationConfig;
  sensitive: SensitiveConfig;
}

export interface GeneralConfig {
  flood: FloodConfig[];
  too_long_amount_to: number;
  identical_amount_to: number;
  bot_call_amount_to: number;
}

export interface HumanVerificationConfig {
  enabled: boolean;
  maxnum: number;
}

export interface SensitiveConfig {
  enabled: boolean;
  penalties: {
    severity: number;
    penalty: {
      penalty_type: PenaltyType;
      severity?: number;
      credit_deduction?: number;
      penalty_time?: number;
    };
  }[];
}

export interface FloodConfig {
  windowSize: number;
  maxMessages: number;  
  maxLength: number;
  penalty: {
    penalty_type: PenaltyType;
    severity?: number;
    credit_deduction?: number;
    penalty_time?: number;
  };
}

export interface ModerationConfig {
  enabled: boolean;
  pool_size: number;
  max_await_time: number;
  adj?: string;
  penalties: SeverityConfig[];
}

export interface SeverityConfig {
  severity: number;
  penalty: {
    penalty_type: PenaltyType;
    severity?: number;
    credit_deduction?: number;
    penalty_time?: number;
  };
}

export interface ImageBlacklistConfig {
  enabled: boolean;
  hammingDistanceThreshold: number;
  penalty: {
    penalty_type: PenaltyType;
    severity: number;
    credit_deduction: number;
  };
}


export interface WhitelistBlacklistConfig {
  enabled: boolean;
  mode: 'whitelist' | 'blacklist';
  groups: number[];
  users: number[];
}

export interface AIProvider {
  name: string;
  apiKey: string;
  baseURL: string;
  model: string;
  enable: boolean;
}

export interface AIConfig {
  enable: boolean;
  providers: AIProvider[];
  chat_use_provider: string[];
  moderation_use_provider: string[];
  profiles: {
    [key: string]: CharacterProfile;
  };
  activeProfile: string;
  reject_prompt_injection: string;
}


export interface CharacterProfile {
    name: string;
    prompt: {
        personality: string;
        reply_style: string;
        on_remind_recall_forward: string;
        on_remind_flood: string;
        on_remind_violation: string;
    }
}

export interface RobotConfig {
    include_official_robot: boolean;
    custom_robots: number[];
}

export interface HelperConfig {
    admins_group: number;
    recall_preventer: {
        enabled: boolean;
    };
    suppression?: SuppressionConfig;
}

export interface SuppressionConfig {
    default_max_energy: number;
    default_energy: number;
    default_regen_per_second: number;
    default_period_sec: number;
    regen_base: number;
    normal_message_cost: number;
    long_message_cost: number;
    long_message_threshold: number;
    mute_seconds_per_negative_energy: number;
    reset_energy_on_supp: boolean;
}

export interface ImageCleanupConfig {
    enabled: boolean;
    retention_days: number;
}