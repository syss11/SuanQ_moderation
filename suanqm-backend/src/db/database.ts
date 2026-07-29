import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as dotenv from 'dotenv';
import { createConnection } from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config();

export const dbType = process.env.DB_TYPE || 'sqljs';

const entitiesPath = dbType === 'mysql' 
  ? './entities/index.js' 
  : './entities/sqljs/index.js';

export const entityModule = await import(entitiesPath);

export const {
  User,
  GroupMessage,
  GroupChat,
  GroupMember,
  PrivateMessage,
  Image,
  Violation,
  HumanVerification,
  UserInteraction,
  CoAdmin,
  CommandLog,
} = entityModule;

export type UserEntity = typeof User;
export type GroupMessageEntity = typeof GroupMessage;
export type GroupChatEntity = typeof GroupChat;
export type GroupMemberEntity = typeof GroupMember;
export type PrivateMessageEntity = typeof PrivateMessage;
export type ImageEntity = typeof Image;
export type ViolationEntity = typeof Violation;
export type HumanVerificationEntity = typeof HumanVerification;
export type UserInteractionEntity = typeof UserInteraction;
export type CoAdminEntity = typeof CoAdmin;
export type CommandLogEntity = typeof CommandLog;

// Export enums from Violation entity
export { ViolationType, PenaltyType, ViolationStatus } from './entities/sqljs/Violation.js';

const commonConfig = {
  entities: [
    User,
    GroupMessage,
    GroupChat,
    GroupMember,
    PrivateMessage,
    Image,
    Violation,
    HumanVerification,
    UserInteraction,
    CoAdmin,
    CommandLog,
  ],
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
  logging: process.env.DB_LOGGING === 'true',
};

let dataSourceConfig: DataSourceOptions;

if (dbType === 'mysql') {
  dataSourceConfig = {
    ...commonConfig,
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'suanq_moderation',
  };
} else {
  dataSourceConfig = {
    ...commonConfig,
    type: 'sqljs',
    location: process.env.DB_STORAGE || './data/database.sqlite',
    autoSave: true,
  };
}

export async function createDatabaseIfNotExists(): Promise<void> {
  if (dbType !== 'mysql') return;

  const { host, port, username, password, database } = dataSourceConfig as any;

  try {
    const connection = await createConnection({
      host,
      port,
      user: username,
      password,
    });

    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.end();

    console.log(`✅ 数据库 ${database} 已创建或已存在`);
  } catch (error) {
    console.error('❌ 创建数据库失败:', error);
    throw error;
  }
}

export const AppDataSource = new DataSource(dataSourceConfig);
