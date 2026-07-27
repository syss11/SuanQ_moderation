import { AppDataSource, createDatabaseIfNotExists } from './database.js';
import { logger } from '../logger.js';

export async function initializeDatabase() {
  try {
    await createDatabaseIfNotExists();

    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      logger.log('✅ 数据库连接已初始化');
      
      if (process.env.DB_SYNCHRONIZE === 'true') {
        await AppDataSource.synchronize();
        logger.log('✅ 数据库表结构已同步');
      }
    } else {
      logger.log('ℹ️ 数据库连接已经初始化');
    }

  } catch (error) {
    logger.error('❌ 数据库初始化失败:', error);
    throw error;
  }
}