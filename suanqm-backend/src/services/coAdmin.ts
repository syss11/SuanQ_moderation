import coAdminService from "../db/services/CoAdminService.js";

type CoAdminCommandType = 'ban' | 'recall' | 'verify' | 'banimg' | 'deduct';

interface CoAdminCommandParams {
  duration?: number;
  difficulty?: string;
  amount?: number;
}

interface CoAdminResult {
  allowed: boolean;
  message?: string;
  remainingRuling?: number | null;
  cost?: number;
}

function calculateBanCost(duration: number): number {
  const cost = Math.ceil(duration / 120);
  return Math.max(cost, 5);
}


function extractCommandParams(command: CoAdminCommandType, rawParams?: Record<string, string|number|boolean>): CoAdminCommandParams {
  const params: CoAdminCommandParams = {};
  if (!rawParams) return params;

  switch (command) {
    case 'ban':
      if (rawParams.duration !== undefined) {
        params.duration = rawParams.duration as number;
      }
      break;
    case 'verify':
      if (rawParams.difficulty !== undefined) {
        params.difficulty = rawParams.difficulty as string;
      }
      break;
    case 'deduct':
      if (rawParams.amount !== undefined) {
        params.amount = rawParams.amount as number;
      }
      break;
  }
  return params;
}

function getCommandCost(command: CoAdminCommandType, params?: CoAdminCommandParams): number {
  switch (command) {
    case 'ban':
      return calculateBanCost(params?.duration ?? 300);
    case 'verify':
      return 5;
    case 'recall':
      return 5;
    case 'banimg':
      return 10;
    case 'deduct':
      return Math.max((params?.amount ?? 1) * 2, 2);
    default:
      return 5;
  }
}

class CoAdminHandler {
  async canExecute(userId: number, groupId: number, command: CoAdminCommandType, rawParams?: Record<string, string|number|boolean>): Promise<CoAdminResult> {
    const isAdmin = await coAdminService.isCoAdmin(userId, groupId);
    if (!isAdmin) {
      return { allowed: false, message: '你不是协管，无法使用此命令' };
    }

    const remaining = await coAdminService.getRemainingRuling(userId, groupId);
    if (remaining === null) {
      return { allowed: false, message: '协管信息查询失败' };
    }

    const params = extractCommandParams(command, rawParams);
    const cost = getCommandCost(command, params);
    if (remaining < cost) {
      return {
        allowed: false,
        message: `裁决点不足，需要 ${cost} 点，剩余 ${remaining} 点`,
        remainingRuling: remaining,
        cost
      };
    }

    return {
      allowed: true,
      message: `裁决点充足，剩余 ${remaining} 点`,
      remainingRuling: remaining,
      cost
    };
  }

  async handleBan(userId: number, groupId: number, duration: number = 300): Promise<CoAdminResult> {
    const result = await this.canExecute(userId, groupId, 'ban', { duration });
    if (!result.allowed) {
      return result;
    }

    const cost = getCommandCost('ban', { duration });
    await coAdminService.decrementRuling(userId, groupId, cost);
    const remaining = await coAdminService.getRemainingRuling(userId, groupId);

    return {
      allowed: true,
      message: `禁言成功，消耗 ${cost} 裁决点，剩余 ${remaining} 点`,
      remainingRuling: remaining,
      cost
    };
  }

  async handleRecall(userId: number, groupId: number): Promise<CoAdminResult> {
    const result = await this.canExecute(userId, groupId, 'recall');
    if (!result.allowed) {
      return result;
    }

    const cost = getCommandCost('recall');
    await coAdminService.decrementRuling(userId, groupId, cost);
    const remaining = await coAdminService.getRemainingRuling(userId, groupId);

    return {
      allowed: true,
      message: `撤回成功，消耗 ${cost} 裁决点，剩余 ${remaining} 点`,
      remainingRuling: remaining,
      cost
    };
  }

  async handleVerify(userId: number, groupId: number, difficulty: string = 'medium'): Promise<CoAdminResult> {
    const result = await this.canExecute(userId, groupId, 'verify', { difficulty });
    if (!result.allowed) {
      return result;
    }

    const cost = getCommandCost('verify', { difficulty });
    await coAdminService.decrementRuling(userId, groupId, cost);
    const remaining = await coAdminService.getRemainingRuling(userId, groupId);

    return {
      allowed: true,
      message: `验证发起成功，消耗 ${cost} 裁决点，剩余 ${remaining} 点`,
      remainingRuling: remaining,
      cost
    };
  }

  async handleBanImg(userId: number, groupId: number): Promise<CoAdminResult> {
    const result = await this.canExecute(userId, groupId, 'banimg');
    if (!result.allowed) {
      return result;
    }

    const cost = getCommandCost('banimg');
    await coAdminService.decrementRuling(userId, groupId, cost);
    const remaining = await coAdminService.getRemainingRuling(userId, groupId);

    return {
      allowed: true,
      message: `图片禁用成功，消耗 ${cost} 裁决点，剩余 ${remaining} 点`,
      remainingRuling: remaining,
      cost
    };
  }

  async handleDeduct(userId: number, groupId: number, amount: number = 1): Promise<CoAdminResult> {
    const result = await this.canExecute(userId, groupId, 'deduct', { amount });
    if (!result.allowed) {
      return result;
    }

    const cost = getCommandCost('deduct', { amount });
    await coAdminService.decrementRuling(userId, groupId, cost);
    const remaining = await coAdminService.getRemainingRuling(userId, groupId);

    return {
      allowed: true,
      message: `信誉分扣除成功，消耗 ${cost} 裁决点，剩余 ${remaining} 点`,
      remainingRuling: remaining,
      cost
    };
  }

  async handleCommand(userId: number, groupId: number, command: CoAdminCommandType, params?: CoAdminCommandParams): Promise<CoAdminResult> {
    switch (command) {
      case 'ban':
        return await this.handleBan(userId, groupId, params?.duration ?? 300);
      case 'recall':
        return await this.handleRecall(userId, groupId);
      case 'verify':
        return await this.handleVerify(userId, groupId, params?.difficulty ?? 'medium');
      case 'banimg':
        return await this.handleBanImg(userId, groupId);
      case 'deduct':
        return await this.handleDeduct(userId, groupId, params?.amount ?? 1);
      default:
        return { allowed: false, message: `不支持的命令类型: ${command}` };
    }
  }
}

export default new CoAdminHandler();
export type { CoAdminCommandType, CoAdminCommandParams, CoAdminResult };