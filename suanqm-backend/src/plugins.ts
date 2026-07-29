import { promises as fs } from 'fs';
import fsSync from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';
import { UserService, userService } from './db/services/UserService.js';
import coAdminService from './db/services/CoAdminService.js';
import { ViolationService, violationService } from './db/services/ViolationService.js';
import commandLogService from './db/services/CommandLogService.js';
import { HumanVerificationService, humanVerificationService } from './db/services/HumanVerificationService.js';
import { MessageQuery, messageQuery } from './db/services/MessageQuery.js';
import { MessageService, messageService } from './db/services/MessageServices.js';
import userInteractionService from './db/services/UserInteractionService.js';
import { AppDataSource } from './db/database.js';
import WebServer from './server/index.js';
import { SqAdapter } from './napcat/adapter.js';
import { callbackManager } from './handler/callback.js';
import { Simplified_Messages } from './server/utils/suanq_types.js';
import napcat from './napcat/index.js';
import { SuanqCommand, registerCommand, unregisterCommand } from './handler/commands.js';
import { quick_reply } from './handler/utils.js';

export interface PluginConfig {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  enabled: boolean;
}

export interface PluginServices {
  userService: UserService;
  coAdminService: typeof coAdminService;
  violationService: ViolationService;
  commandLogService: typeof commandLogService;
  humanVerificationService: HumanVerificationService;
  messageQuery: MessageQuery;
  messageService: MessageService;
  userInteractionService: typeof userInteractionService;
}

export interface PluginContext {
  logger: typeof logger;
  adapter: SqAdapter;
  napcat: typeof napcat;
  registerHandler: (handler: any) => void;
  unregisterHandler: (handler: any) => void;
  
  getConfig: () => ReturnType<typeof import('./config/index.js').getConfig>;
  database: typeof AppDataSource;
  webServer: WebServer;
  services: PluginServices;
  
  registerCallback: (
    groupId: number,
    userId: number,
    callback: (message: Simplified_Messages) => Promise<void>,
    once?: boolean
  ) => void;
  
  registerCommand: typeof registerCommand;
  unregisterCommand: typeof unregisterCommand;
  
  quickReply: typeof quick_reply;
  
  SuanqCommand: typeof SuanqCommand;
}

export interface Plugin {
  id: string;
  config: PluginConfig;
  instance: any;
  handlers: any[];

  onLoad?(context: PluginContext): Promise<void>;
  onEnable?(context: PluginContext): Promise<void>;
  onDisable?(context: PluginContext): Promise<void>;
  onUnload?(context: PluginContext): Promise<void>;
}

class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private pluginsDirectory: string;
  private distPluginsDirectory: string;
  private context: PluginContext | null = null;

  constructor() {
    const cwd = join(process.cwd());
    this.pluginsDirectory = join(cwd, 'src','plugins');
    this.distPluginsDirectory = join(cwd, 'dist','plugins');
    
    // 确保 plugins 目录存在
    if (!fsSync.existsSync(this.pluginsDirectory)) {
      fsSync.mkdirSync(this.pluginsDirectory, { recursive: true });
      logger.log(`插件管理器: 创建 plugins 目录 ${this.pluginsDirectory}`);
    }
    
    // 确保 dist/plugins 目录存在
    if (!fsSync.existsSync(this.distPluginsDirectory)) {
      fsSync.mkdirSync(this.distPluginsDirectory, { recursive: true });
    }
  }

  initialize(
    adapter: SqAdapter,
    getConfig: () => ReturnType<typeof import('./config/index.js').getConfig>,
    database: typeof AppDataSource,
    webServer: WebServer
  ): void {
    const services: PluginServices = {
      userService: userService,
      coAdminService: coAdminService,
      violationService: violationService,
      commandLogService: commandLogService,
      humanVerificationService: humanVerificationService,
      messageQuery: messageQuery,
      messageService: messageService,
      userInteractionService: userInteractionService,
    };

    this.context = {
      logger: logger,
      adapter: adapter,
      napcat: napcat,
      registerHandler: this.registerHandler.bind(this),
      unregisterHandler: this.unregisterHandler.bind(this),
      getConfig,
      database,
      webServer,
      services,
      registerCallback: callbackManager.register_callback.bind(callbackManager),
      registerCommand: (command: SuanqCommand) => registerCommand(command, true),
      unregisterCommand,
      quickReply: quick_reply,
      SuanqCommand,
    };
  }

  private registerHandler(handler: any): void {
    if (!this.context?.adapter) return;
    const allHandlers = [...(this.context.adapter as any).handlers || []];
    if (!allHandlers.includes(handler)) {
      (this.context.adapter as any).handlers = [...allHandlers, handler];
      logger.log(`插件管理器: 注册处理器`);
    }
  }

  private unregisterHandler(handler: any): void {
    if (!this.context?.adapter) return;
    const allHandlers = [...(this.context.adapter as any).handlers || []];
    (this.context.adapter as any).handlers = allHandlers.filter(h => h !== handler);
    logger.log(`插件管理器: 注销处理器`);
  }

  async discoverPlugins(): Promise<PluginConfig[]> {
    const configs: PluginConfig[] = [];
    try {
      const entries = await fs.readdir(this.pluginsDirectory, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== 'node_modules') {
          const pluginDir = join(this.pluginsDirectory, entry.name);
          const configPath = join(pluginDir, 'plugin_config.json');
          
          // 复制资源和配置文件到编译后的目录
          await this.copyPluginAssets(pluginDir, entry.name);

          if (await this.fileExists(configPath)) {
            try {
              const configContent = await fs.readFile(configPath, 'utf-8');
              const config = JSON.parse(configContent) as PluginConfig;
              configs.push(config);
              
              
            } catch (error) {
              logger.error(`插件管理器: 解析插件配置失败 ${entry.name}:`, error);
            }
          }
        }
      }
    } catch (error) {
      logger.error(`插件管理器: 发现插件失败:`, error);
    }
    return configs;
  }

  private async copyPluginAssets(sourceDir: string, pluginId: string): Promise<void> {
    try {
      const destDir = join(this.distPluginsDirectory, pluginId);
      
      // 确保目标目录存在
      await fs.mkdir(destDir, { recursive: true });
      
      const entries = await fs.readdir(sourceDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const sourcePath = join(sourceDir, entry.name);
        const destPath = join(destDir, entry.name);
        
        // 跳过 TypeScript 源文件和目录
        if (entry.name.endsWith('.ts') || entry.name.endsWith('.ts.map')) {
          continue;
        }
        
        if (entry.isDirectory()) {
          // 递归复制子目录
          await this.copyPluginAssets(sourcePath, join(pluginId, entry.name));
        } else {
          // 复制文件
          await fs.copyFile(sourcePath, destPath);
          
        }
      }
    } catch (error) {
      logger.error(`插件管理器: 复制插件资源失败 ${pluginId}:`, error);
    }
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  async loadPlugin(pluginId: string): Promise<Plugin | null> {
    if (!this.context) {
      logger.error(`插件管理器: 未初始化，请先调用 initialize()`);
      return null;
    }

    if (this.plugins.has(pluginId)) {
      logger.warn(`插件管理器: 插件 ${pluginId} 已加载`);
      return this.plugins.get(pluginId) || null;
    }

    const pluginDir = join(this.pluginsDirectory, pluginId);
    const distPluginDir = join(this.distPluginsDirectory, pluginId);
    const configPath = join(pluginDir, 'plugin_config.json');
    const distIndexPath = join(distPluginDir, 'index.js');

    if (!(await this.fileExists(configPath))) {
      logger.error(`插件管理器: 插件配置文件不存在 ${configPath}`);
      return null;
    }

    if (!(await this.fileExists(distIndexPath))) {
      logger.error(`插件管理器: 插件编译后入口文件不存在 ${distIndexPath}`);
      logger.error(`插件管理器: 请确保已运行 pnpm run build 编译插件`);
      return null;
    }

    try {
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent) as PluginConfig;

      const modulePath = `file://${distIndexPath}`;
      const module = await import(modulePath);
      const instance = module.default || module;

      const plugin: Plugin = {
        id: pluginId,
        config,
        instance,
        handlers: [],
        onLoad: instance.onLoad?.bind(instance),
        onEnable: instance.onEnable?.bind(instance),
        onDisable: instance.onDisable?.bind(instance),
        onUnload: instance.onUnload?.bind(instance),
      };

      if (plugin.onLoad) {
        try {
          await plugin.onLoad(this.context);
          logger.log(`插件管理器: 插件 ${pluginId} onLoad 执行成功`);
        } catch (onLoadError) {
          logger.error(`插件管理器: 插件 ${pluginId} onLoad 执行失败:`, onLoadError);
          logger.error(`插件管理器: 错误详情: ${JSON.stringify(onLoadError, Object.getOwnPropertyNames(onLoadError))}`);
          throw onLoadError;
        }
      }

      this.plugins.set(pluginId, plugin);
      logger.log(`插件管理器: 插件 ${pluginId} 加载成功`);

      if (config.enabled && plugin.onEnable) {
        logger.log(`插件管理器: 插件 ${pluginId} 配置为启用状态，正在启用...`);
        await plugin.onEnable(this.context);
        logger.log(`插件管理器: 插件 ${pluginId} 启用成功`);
      }

      return plugin;
    } catch (error) {
      logger.error(`插件管理器: 加载插件 ${pluginId} 失败:`);
      logger.error(`插件管理器: 错误类型: ${typeof error}`);
      logger.error(`插件管理器: 错误对象:`, error);
      logger.error(`插件管理器: 错误详情: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`);
      return null;
    }
  }

  async unloadPlugin(pluginId: string): Promise<boolean> {
    if (!this.context) {
      logger.error(`插件管理器: 未初始化，请先调用 initialize()`);
      return false;
    }

    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      logger.warn(`插件管理器: 插件 ${pluginId} 未加载`);
      return false;
    }

    try {
      // 如果插件已启用，先禁用（不保存配置）
      if (plugin.config.enabled && plugin.onDisable) {
        await plugin.onDisable(this.context);
      }

      if (plugin.onUnload) {
        await plugin.onUnload(this.context);
      }

      plugin.handlers.forEach(handler => {
        this.unregisterHandler(handler);
      });

      this.plugins.delete(pluginId);
      logger.log(`插件管理器: 插件 ${pluginId} 卸载成功`);
      return true;
    } catch (error) {
      logger.error(`插件管理器: 卸载插件 ${pluginId} 失败:`, error);
      return false;
    }
  }

  async enablePlugin(pluginId: string): Promise<boolean> {
    if (!this.context) {
      logger.error(`插件管理器: 未初始化，请先调用 initialize()`);
      return false;
    }

    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      logger.warn(`插件管理器: 插件 ${pluginId} 未加载`);
      return false;
    }

    if (plugin.config.enabled) {
      logger.warn(`插件管理器: 插件 ${pluginId} 已启用`);
      return true;
    }

    try {
      if (plugin.onEnable) {
        logger.log(`插件管理器: 执行插件 ${pluginId} onEnable`);
        await plugin.onEnable(this.context);
        logger.log(`插件管理器: 插件 ${pluginId} onEnable 执行成功`);
      }

      plugin.config.enabled = true;
      await this.savePluginConfig(plugin);
      logger.log(`插件管理器: 插件 ${pluginId} 启用成功`);
      return true;
    } catch (error) {
      logger.error(`插件管理器: 启用插件 ${pluginId} 失败:`);
      logger.error(`插件管理器: 错误类型: ${typeof error}`);
      logger.error(`插件管理器: 错误对象:`, error);
      logger.error(`插件管理器: 错误详情: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`);
      return false;
    }
  }

  async disablePlugin(pluginId: string): Promise<boolean> {
    if (!this.context) {
      logger.error(`插件管理器: 未初始化，请先调用 initialize()`);
      return false;
    }

    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      logger.warn(`插件管理器: 插件 ${pluginId} 未加载`);
      return false;
    }

    if (!plugin.config.enabled) {
      logger.warn(`插件管理器: 插件 ${pluginId} 已禁用`);
      return true;
    }

    try {
      if (plugin.onDisable) {
        await plugin.onDisable(this.context);
      }

      plugin.handlers.forEach(handler => {
        this.unregisterHandler(handler);
      });
      plugin.handlers = [];

      plugin.config.enabled = false;
      await this.savePluginConfig(plugin);
      logger.log(`插件管理器: 插件 ${pluginId} 禁用成功`);
      return true;
    } catch (error) {
      logger.error(`插件管理器: 禁用插件 ${pluginId} 失败:`, error);
      return false;
    }
  }

  private async savePluginConfig(plugin: Plugin): Promise<void> {
    const configPath = join(this.pluginsDirectory, plugin.id, 'plugin_config.json');
    await fs.writeFile(configPath, JSON.stringify(plugin.config, null, 2), 'utf-8');
  }

  async loadAllPlugins(): Promise<Plugin[]> {
    const configs = await this.discoverPlugins();
    const loadedPlugins: Plugin[] = [];

    for (const config of configs) {
      try {
        if (!config.id) {
          logger.error(`插件管理器: 插件配置缺少 id 字段，跳过`);
          continue;
        }
        
        const plugin = await this.loadPlugin(config.id);
        if (plugin) {
          loadedPlugins.push(plugin);
        }
      } catch (error) {
        logger.error(`插件管理器: 加载插件 ${config.id} 失败:`, error);
      }
    }

    logger.log(`插件管理器: 共加载 ${loadedPlugins.length} 个插件`);
    return loadedPlugins;
  }

  async unloadAllPlugins(): Promise<void> {
    const pluginIds = Array.from(this.plugins.keys());
    for (const pluginId of pluginIds) {
      await this.unloadPlugin(pluginId);
    }
    logger.log(`插件管理器: 所有插件已卸载`);
  }

  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  getEnabledPlugins(): Plugin[] {
    return Array.from(this.plugins.values()).filter(p => p.config.enabled);
  }

  getPluginStatus(pluginId: string): {
    loaded: boolean;
    enabled: boolean;
    config?: PluginConfig;
  } {
    const plugin = this.plugins.get(pluginId);
    return {
      loaded: !!plugin,
      enabled: plugin?.config.enabled || false,
      config: plugin?.config,
    };
  }
}

const pluginManager = new PluginManager();

export { pluginManager };
export default pluginManager;