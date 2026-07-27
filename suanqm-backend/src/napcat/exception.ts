import { AllHandlers } from "node-napcat-ts";
import { SqHandler } from "./adapter.js";
import { logger } from "../logger.js";
import { shutdown } from "../index.js";

export const err_handlers=[
    new SqHandler('api.response.failure', (context: AllHandlers['api.response.failure']) => {
        logger.error('调用napcat失败:', context);
    }),
    new SqHandler('socket.close', (context: AllHandlers['socket.close']) => {
        logger.info('socket关闭,重试次数:', context.reconnection.nowAttempts);
        if (context.reconnection.nowAttempts >= context.reconnection.attempts) {
            logger.error('socket关闭,断开连接');
            shutdown();
        }
    }),
]