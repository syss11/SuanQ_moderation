import { Router } from 'express';
import { authMiddleware } from './middleware/auth.js';
import fs from 'fs';
import path from 'path';
import JSON5 from 'json5';
import { logger } from '../logger.js';
import { validateConfig, logValidationResult } from '../config/validify.js';

const router = Router();

const configPath = path.resolve(process.cwd(), 'config', 'config.json');

router.get('/api/settings/config', authMiddleware, async (req, res) => {
  try {
    if (!fs.existsSync(configPath)) {
      return res.status(404).json({
        code: 404,
        message: '配置文件不存在',
        data: null
      });
    }

    const configContent = fs.readFileSync(configPath, 'utf-8');
    
    res.status(200).json({
      code: 200,
      message: '获取配置文件成功',
      data: {
        content: configContent
      }
    });
  } catch (error) {
    logger.error('获取配置文件失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取配置文件失败',
      data: null
    });
  }
});

router.post('/api/settings/config', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;

    if (typeof content !== 'string') {
      return res.status(400).json({
        code: 400,
        message: '配置内容必须是字符串',
        data: null
      });
    }

    try {
      const parsedConfig = JSON5.parse(content);
      
      const validationResult = validateConfig(parsedConfig);
      logValidationResult(validationResult);
      
      if (!validationResult.valid) {
        return res.status(400).json({
          code: 400,
          message: '配置验证失败',
          data: {
            errors: validationResult.errors,
            warnings: validationResult.warnings
          }
        });
      }
    } catch (parseError) {
      return res.status(400).json({
        code: 400,
        message: '配置文件格式错误，无法解析',
        data: {
          error: String(parseError)
        }
      });
    }

    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    fs.writeFileSync(configPath, content, 'utf-8');

    res.status(200).json({
      code: 200,
      message: '配置文件保存成功',
      data: null
    });
  } catch (error) {
    logger.error('保存配置文件失败:', error);
    res.status(500).json({
      code: 500,
      message: '保存配置文件失败',
      data: null
    });
  }
});

export default router;
