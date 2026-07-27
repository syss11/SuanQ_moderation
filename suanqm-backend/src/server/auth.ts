import { Router, Request, Response } from 'express';
import { generateToken } from './middleware/auth.js';
import * as dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { logger } from '../logger.js';

dotenv.config();

const router = Router();

// 登录速率限制中间件
const loginRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5, // 每个IP在窗口期内最多5次尝试
  message: {
    code: 429,
    message: '请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * 登录路由
 * 使用密码换取JWT令牌
 * POST /api/auth/login
 */
router.post('/api/auth/login', loginRateLimit, (req: Request, res: Response) => {
  try {
    // 获取请求体中的密码
    const { password } = req.body;
    
    // 检查密码是否存在
    if (!password) {
      return res.status(400).json({
        code: 400,
        message: '密码不能为空'
      });
    }
    
    // 从环境变量中获取预设的密码
    const validPassword = process.env.AUTH_PASSWORD;
    
    // 验证密码
    if (!validPassword || password !== validPassword) {
      return res.status(401).json({
        code: 401,
        message: '密码错误'
      });
    }
    
    // 生成JWT令牌
    const token = generateToken();
    
    // 返回令牌
    return res.status(200).json({
      code: 200,
      message: '登录成功',
      data: {
        token,
        expiresIn: 60 * 60 * 60 // 3600秒，1小时
      }
    });
  } catch (error) {
    logger.error('登录错误:', error);
    return res.status(500).json({
      code: 500,
      message: '登录失败，请重试'
    });
  }
});

export default router;