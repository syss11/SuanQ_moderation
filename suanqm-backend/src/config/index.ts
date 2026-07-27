import fs from 'fs';
import path from 'path';
import JSON5 from 'json5';
import AppConfig from './config.js'
import { logger } from '../logger.js';
import { validateConfig, logValidationResult } from './validify.js';
import { generateRulesDocumentationFromConfig } from './documentation.js';

// 配置文件路径
const getConfigPath = (): string => {
  const env = (process.env.NODE_ENV || 'production').trim();
  const configFileName = env === 'development' ? 'config.dev.json' : 'config.json';
  const configPath = path.resolve(process.cwd(), 'config', configFileName);
  console.log(`[Config] Environment: ${env}, Config file: ${configFileName}`);
  return configPath;
};

// 内部配置存储
let _config: AppConfig = loadConfig();

// 读取并解析配置文件（启动时使用，失败会退出）
function loadConfig(): AppConfig {
  try {
    const currentConfigPath = getConfigPath();
    logger.log(`正在加载配置文件: ${currentConfigPath}`);
    logger.log(`当前环境: ${process.env.NODE_ENV || 'production'}`);
    
    // 检查配置文件是否存在
    if (!fs.existsSync(currentConfigPath)) {
      logger.error(`配置文件不存在: ${currentConfigPath}`);
      process.exit(1);
    }

    // 读取配置文件内容
    const configContent = fs.readFileSync(currentConfigPath, 'utf-8');
    
    // 使用JSON5解析配置
    const config = JSON5.parse(configContent);
    
    // 验证配置
    const validationResult = validateConfig(config);
    logValidationResult(validationResult);
    
    // 如果验证失败，退出程序
    if (!validationResult.valid) {
      logger.error('配置验证失败，程序退出');
      process.exit(1);
    }
    
    return config as AppConfig;
  } catch (error) {
    logger.error('解析配置文件失败:', error);
    process.exit(1);
  }
}

// 读取并解析配置文件（运行时使用，失败不会退出）
function loadConfigSafe(): AppConfig {
  try {
    const currentConfigPath = getConfigPath();
    
    // 检查配置文件是否存在
    if (!fs.existsSync(currentConfigPath)) {
      logger.error(`配置文件不存在: ${currentConfigPath}`);
      return _config;
    }

    // 读取配置文件内容
    const configContent = fs.readFileSync(currentConfigPath, 'utf-8');
    
    // 使用JSON5解析配置
    const config = JSON5.parse(configContent);
    
    // 验证配置
    const validationResult = validateConfig(config);
    logValidationResult(validationResult);
    
    // 如果验证失败，返回旧配置
    if (!validationResult.valid) {
      logger.error('配置验证失败，保持原配置');
      return _config;
    }
    
    return config as AppConfig;
  } catch (error) {
    logger.error('解析配置文件失败:', error);
    return _config;
  }
}

// 保存配置到文件
export const saveConfig = (config: AppConfig): boolean => {
  try {
    const currentConfigPath = getConfigPath();
    
    // 将配置转换为 JSON5 格式字符串，保留注释和格式
    const configContent = JSON5.stringify(config, null, 2);
    
    // 写入配置文件
    fs.writeFileSync(currentConfigPath, configContent, 'utf-8');
    
    logger.log('配置已保存到:', currentConfigPath);
    return true;
  } catch (error) {
    logger.error('保存配置文件失败:', error);
    return false;
  }
};

// 更新配置并保存
export const updateConfig = (updates: Partial<AppConfig>): boolean => {
  try {
    // 读取当前配置
    const currentConfig = loadConfigSafe();
    
    // 合并更新
    const updatedConfig = { ...currentConfig, ...updates };
    
    // 验证更新后的配置
    const validationResult = validateConfig(updatedConfig);
    if (!validationResult.valid) {
      logger.error('更新后的配置验证失败，取消更新');
      logValidationResult(validationResult);
      return false;
    }
    
    // 保存更新后的配置
    const success = saveConfig(updatedConfig);
    
    // 如果保存成功，更新内存中的配置
    if (success) {
      _config = updatedConfig;
    }
    
    return success;
  } catch (error) {
    logger.error('更新配置失败:', error);
    return false;
  }
};

// 重载配置
export const reloadConfig = (): void => {
  _config = loadConfigSafe();
  logger.log('配置已重载');
};

// 导出配置 getter
export function getConfig(): AppConfig {
  return _config;
}

// 生成审查规则文档
export function generateDocumentation(): string {
  return generateRulesDocumentationFromConfig(_config);
}

// 为了向后兼容，导出 appConfig（注意：这个不会自动更新）
export const appConfig = _config;

export interface SetConfigResult {
  success: boolean;
  message: string;
}

// 根据点号路径设置配置值
export const setConfigByPath = (path: string, value: string | boolean | number, action: 'set' | 'add' | 'remove' = 'set'): SetConfigResult => {
  try {
    const keys = path.split('.');
    const currentConfig = loadConfigSafe();
    let obj: any = currentConfig;

    for (let i = 0; i < keys.length - 1; i++) {
      if (obj[keys[i]] === undefined || obj[keys[i]] === null) {
        return { success: false, message: `配置路径不存在: ${path}` };
      }
      obj = obj[keys[i]];
    }

    const lastKey = keys[keys.length - 1];
    if (obj[lastKey] === undefined) {
      return { success: false, message: `配置路径不存在: ${path}` };
    }

    const oldValue = obj[lastKey];
    
    if (action === 'add' || action === 'remove') {
      if (!Array.isArray(obj[lastKey])) {
        return { success: false, message: `配置项 ${path} 不是数组类型，无法执行 ${action} 操作` };
      }
      
      if (action === 'add') {
        if (!obj[lastKey].includes(value)) {
          obj[lastKey].push(value);
        } else {
          return { success: false, message: `值 ${JSON.stringify(value)} 已存在于 ${path} 数组中` };
        }
      } else {
        const index = obj[lastKey].indexOf(value);
        if (index > -1) {
          obj[lastKey].splice(index, 1);
        } else {
          return { success: false, message: `值 ${JSON.stringify(value)} 不存在于 ${path} 数组中` };
        }
      }
    } else {
      obj[lastKey] = value;
    }

    const validationResult = validateConfig(currentConfig);
    if (!validationResult.valid) {
      logValidationResult(validationResult);
      return { success: false, message: '配置验证失败，取消更新' };
    }

    const saveSuccess = saveConfig(currentConfig);
    if (saveSuccess) {
      _config = currentConfig;
      if (action === 'add') {
        return { success: true, message: `已向 ${path} 数组添加值: ${JSON.stringify(value)}` };
      } else if (action === 'remove') {
        return { success: true, message: `已从 ${path} 数组移除值: ${JSON.stringify(value)}` };
      }
      return { success: true, message: `已将 ${path} 从 ${JSON.stringify(oldValue)} 修改为 ${JSON.stringify(obj[lastKey])}` };
    }
    return { success: false, message: '保存配置文件失败' };
  } catch (error) {
    logger.error('设置配置失败:', error);
    return { success: false, message: error instanceof Error ? error.message : '未知错误' };
  }
};
