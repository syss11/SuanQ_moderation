import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

let jwtSecret: string = '';

/**
 * 设置JWT密钥
 */
export function setJwtSecret(secret: string): void {
  jwtSecret = secret;
}

/**
 * 生成JWT令牌
 * 不需要用户信息，只需要基本的令牌结构
 */
export function generateToken(expiresIn: any = 60*60*60): string {
  if (!jwtSecret) {
    throw new Error('JWT secret has not been set');
  }
  // 生成不包含用户信息的令牌
  const payload = {
    authenticated: true,
    timestamp: Date.now()
  };
  return jwt.sign(payload, jwtSecret, { expiresIn: expiresIn });
}

/**
 * 验证JWT令牌
 */
export function verifyToken(token: string): JwtPayload | string {
  if (!jwtSecret) {
    throw new Error('JWT secret has not been set');
  }
  return jwt.verify(token, jwtSecret);
}

/**
 * JWT认证中间件
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // 从请求头获取Authorization
  const authHeader = req.header('Authorization');
  
  // 检查Authorization头是否存在
  if (!authHeader) {
    return res.status(401).json({
      code: 401,
      message: '未提供认证令牌'
    });
  }
  
  // 检查Authorization头格式
  const [bearer, token] = authHeader.split(' ');
  if (bearer !== 'Bearer' || !token) {
    return res.status(401).json({
      code: 401,
      message: '认证令牌格式不正确'
    });
  }
  
  try {
    // 验证令牌
    const decoded = verifyToken(token);
    
    // 将解码后的信息存储在请求对象中
    (req as any).auth = decoded;
    
    next();
  } catch (error) {
    return res.status(401).json({
      code: 401,
      message: '认证令牌无效或已过期'
    });
  }
};