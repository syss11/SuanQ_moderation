import AppConfig from './config.js';
import { logger } from '../logger.js';

export function generateRulesDocumentation(config: AppConfig): string {
  const lines: string[] = [];
  const activeProfile = config.ai.profiles[config.ai.activeProfile];

  lines.push('# 群聊管理规则\n');
  lines.push(`我是管理员${activeProfile?.name || config.ai.activeProfile}，下面是本群的管理规则说明。\n`);

  lines.push('## 基础功能\n');
  lines.push(`- 指令功能: ${config.enable_commands}`);
  lines.push(`- 调试模式: ${config.debug.enable_tools}\n`);

  lines.push('## 积分系统\n');
  lines.push(`- 初始积分: ${config.user.credit.default}`);
  lines.push(`- 积分上限: ${config.user.credit.max}`);
  lines.push(`- 积分过低阈值: ${config.user.credit.kick_threshold}\n`);
  
  lines.push('### 互动系统\n');
  lines.push(`- 互动方法: 对对方的消息添加表情回复（[点赞]/[敲打]），执行点赞或点踩操作。`);
  lines.push(`- 互动次数: 每个用户每日最多 ${config.user.credit.max_daily_interactions} 次`);
  lines.push(`- 点赞将增加对方 ${config.user.credit.like_award !== undefined ? config.user.credit.like_award : '未设置'} 分`);
  lines.push(`- 点踩将减少对方 ${config.user.credit.dislike_penalty !== undefined ? config.user.credit.dislike_penalty : '未设置'} 分`);
  lines.push(`- 请友善互动，避免引发矛盾。注意:互动不可取消,只可对一天内的消息进行互动\n`);



  lines.push('### 积分段位说明\n');
  if (config.user.credit.tiers && config.user.credit.tiers.length > 0) {
    config.user.credit.tiers.forEach((tier, index) => {
      lines.push(`${index + 1}. 积分 ${tier.min_credit} ~ ${tier.max_credit}：`);
      lines.push(`   - 积分扣除倍率: ${tier.dc_multiplier}x`);
      lines.push(`   - 禁言时长倍率: ${tier.mute_multiplier}x`);
      lines.push(`   - 签到奖励: ${tier.checkin_award !== undefined ? tier.checkin_award : '未设置'} 分`);
    });
    lines.push('');
  }

  lines.push('## 机器人识别\n');
  lines.push(`- 识别官方机器人: ${config.robot.include_official_robot}`);
  lines.push(`- 自定义机器人: ${config.robot.custom_robots.length} 个\n`);

  lines.push('## 群组管理\n');

  lines.push('### 白名单/黑名单\n');
  lines.push(`- 启用状态: ${config.rules.whitelistBlacklist.enabled}`);
  lines.push(`- 管理模式: ${config.rules.whitelistBlacklist.mode}`);
  lines.push(`- 管理群组: ${config.rules.whitelistBlacklist.groups.length} 个`);
  lines.push(`- 管理用户: ${config.rules.whitelistBlacklist.users.length} 个\n`);

  lines.push('### 刷屏检测\n');
  if (config.rules.general.flood && config.rules.general.flood.length > 0) {
    config.rules.general.flood.forEach((rule, index) => {
      lines.push(`**规则 ${index + 1}**`);
      lines.push(`- 时间窗口: ${rule.windowSize} 秒`);
      lines.push(`- 消息上限: ${rule.maxMessages} 条`);
      lines.push(`- 消息长度限制: ${rule.maxLength} 字符`);
      lines.push(`- 惩罚方式: ${getPenaltyTypeName(rule.penalty.penalty_type)}`);
      lines.push(`- 惩罚等级: ${rule.penalty.severity}`);
      lines.push(`- 扣除积分: ${rule.penalty.credit_deduction}`);
      lines.push(`- 惩罚时长: ${rule.penalty.penalty_time} 秒\n`);
    });
  }
  lines.push(`注意：“逐条转发”极易触发刷屏检测，建议转发消息数量少些。\n`);

  lines.push(`### 其他违规检测\n`);
  lines.push(`- 超长消息: 等效 ${config.rules.general.too_long_amount_to} 条消息`);
  lines.push(`- 重复消息: 等效 ${config.rules.general.identical_amount_to} 条消息`);
  lines.push(`- 频繁调用机器人: 等效 ${config.rules.general.bot_call_amount_to} 条消息\n`);

  lines.push('### 内容审核\n');
  lines.push(`- 审核功能: ${config.rules.moderation.enabled}`);
  lines.push(`- 消息队列: ${config.rules.moderation.pool_size} 条`);
  lines.push(`- 审核超时: ${config.rules.moderation.max_await_time} 秒`);
  lines.push(`- 审核严格度: ${config.rules.moderation.adj}\n`);

  if (config.rules.moderation.penalties && config.rules.moderation.penalties.length > 0) {
    lines.push(`**违规惩罚等级**\n`);
    config.rules.moderation.penalties.forEach((penalty, index) => {
      lines.push(`等级 ${penalty.severity}:`);
      lines.push(`- 惩罚方式: ${getPenaltyTypeName(penalty.penalty.penalty_type)}`);
      lines.push(`- 扣除积分: ${penalty.penalty.credit_deduction}`);
      lines.push(`- 惩罚时长: ${penalty.penalty.penalty_time} 秒\n`);
    });
  }

  lines.push('### 图片管理\n');
  lines.push(`- 图片黑名单功能: ${config.rules.imageBlacklist.enabled}`);
  lines.push(`- 图片相似度阈值: ${config.rules.imageBlacklist.hammingDistanceThreshold}`);
  lines.push(`- 惩罚方式: ${getPenaltyTypeName(config.rules.imageBlacklist.penalty.penalty_type)}`);
  lines.push(`- 惩罚等级: ${config.rules.imageBlacklist.penalty.severity}`);
  lines.push(`- 扣除积分: ${config.rules.imageBlacklist.penalty.credit_deduction}\n`);

  lines.push('### 敏感词过滤\n');
  lines.push(`- 敏感词过滤功能: ${config.rules.sensitive.enabled}`);
  if (config.rules.sensitive.penalties && config.rules.sensitive.penalties.length > 0) {
    lines.push(`**严重程度惩罚**\n`);
    config.rules.sensitive.penalties.forEach((penalty, index) => {
      lines.push(`等级 ${penalty.severity}:`);
      lines.push(`- 惩罚方式: ${getPenaltyTypeName(penalty.penalty.penalty_type)}`);
      lines.push(`- 扣除积分: ${penalty.penalty.credit_deduction}`);
      lines.push(`- 惩罚时长: ${penalty.penalty.penalty_time} 秒\n`);
    });
  }

  lines.push('### 入群人机验证\n');
  lines.push(`- 验证功能: ${config.rules.humanVerification.enabled}`);
  lines.push(`- 题目数值上限: ${config.rules.humanVerification.maxnum}\n`);

  lines.push('## AI 功能\n');
  lines.push(`- AI 功能: ${config.ai.enable}\n`);

  lines.push('### AI 模型\n');
  if (config.ai.providers && config.ai.providers.length > 0) {
    const enabledProviders = config.ai.providers.filter(p => p.enable).length;
    lines.push(`- 可用模型: ${enabledProviders} 个\n`);
  }

  lines.push('### AI 人格\n');
  if (config.ai.profiles) {

    if (activeProfile) {
      lines.push(`- 当前人格: ${activeProfile.name}`);
      lines.push(`- 人格特点: ${activeProfile.prompt.personality.replaceAll('你','我')}\n`);
    }
  }

  if (config.helper) {
    lines.push('## 辅助功能\n');
    lines.push(`- 防撤回: ${config.helper.recall_preventer.enabled ? '启用' : '禁用'}\n`);
  }

  lines.push('## 协管系统\n');
  lines.push(`协管是群管理员授权的辅助管理者，拥有裁决点系统，可以执行部分管理命令。\n`);

  lines.push('### 裁决点规则\n');
  lines.push(`- 裁决点上限: 由管理员设置`);
  lines.push(`- 每日签到: 协管签到时裁决点将补充至上限`);
  lines.push(`- 查看裁决点: 使用 ruling 命令\n`);

  lines.push('### 命令消耗规则\n');
  lines.push(`- ban (禁言): 每120秒消耗1点，每次最低5点`);
  lines.push(`- recall (撤回): 消耗5点`);
  lines.push(`- verify (人机验证): 消耗5点`);
  lines.push(`- banimg (禁用图片): 消耗10点\n`);
  lines.push(`- deduct (扣除信誉分): 消耗2x扣分值\n`);

  lines.push('### 权限限制\n');
  lines.push(`- 若协管滥用权限，可向管理员反馈`);
  lines.push(`- 协管使用命令需要追加理由`);
  lines.push(`- 协管无法对其他协管进行操作`);

  lines.push('---\n');
  lines.push(`本文档由${activeProfile?.name || config.ai.activeProfile}编写`);
  lines.push('时间: ' + new Date().toLocaleString('zh-CN'));

  return lines.join('\n');
}

function getPenaltyTypeName(type: string): string {
  const typeMap: Record<string, string> = {
    'mute': '禁言',
    'kick': '踢出',
    'credit_deduction': '扣除积分',
    'warning': '警告',
    'other': '其他'
  };
  return typeMap[type] || type;
}

export function generateRulesDocumentationFromConfig(config: AppConfig): string {
  try {
    const doc = generateRulesDocumentation(config);
    logger.log('审查规则文档生成成功');
    return doc;
  } catch (error) {
    logger.error('生成审查规则文档失败:', error);
    return '文档生成失败';
  }
}