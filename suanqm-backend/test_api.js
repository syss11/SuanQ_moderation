import OpenAI from 'openai';
import { readFileSync } from 'fs';
import json5 from 'json5';

const config = json5.parse(readFileSync('./config/config.json', 'utf-8'));
const aiConfig = config.ai;

logger.log('='.repeat(60));
logger.log('API 可用性测试脚本');
logger.log('='.repeat(60));

if (!aiConfig || !aiConfig.enable) {
  logger.error('❌ 错误: AI功能未启用');
  process.exit(1);
}

const providers = aiConfig.providers.filter(p => p.enable);

if (providers.length === 0) {
  logger.error('❌ 错误: 没有启用的AI provider配置');
  process.exit(1);
}

logger.log(`找到 ${providers.length} 个启用的provider:`);
providers.forEach((p, i) => {
  logger.log(`  ${i + 1}. ${p.name}`);
  logger.log(`     Base URL: ${p.baseURL}`);
  logger.log(`     Model: ${p.model}`);
  logger.log(`     API Key: ${p.apiKey ? '已设置 (' + p.apiKey.substring(0, 8) + '...)' : '未设置'}`);
});
logger.log('='.repeat(60));

async function testProvider(provider) {
  const openai = new OpenAI({
    apiKey: provider.apiKey,
    baseURL: provider.baseURL
  });

  try {
    logger.log(`\n📡 正在测试 provider "${provider.name}"...\n`);

    const testMessages = [
      {
        role: 'system',
        content: '你是一个测试助手，请简短回复。'
      },
      {
        role: 'user',
        content: '你好，请回复"测试成功"'
      }
    ];

    logger.log('发送测试请求...');
    logger.log('模型:', provider.model);
    logger.log('消息:', JSON.stringify(testMessages, null, 2));

    const startTime = Date.now();
    
    const response = await openai.chat.completions.create({
      model: provider.model,
      messages: testMessages,
      max_tokens: 64,
      temperature: 0.7,
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    logger.log('\n' + '='.repeat(60));
    logger.log(`✅ Provider "${provider.name}" 调用成功!`);
    logger.log('='.repeat(60));
    logger.log(`响应时间: ${duration}ms`);
    logger.log(`返回内容: ${response.choices[0].message.content}`);
    logger.log(`使用 Token: ${response.usage?.total_tokens || '未知'}`);
    logger.log('='.repeat(60));

    return true;
  } catch (error) {
    logger.log('\n' + '='.repeat(60));
    logger.log(`❌ Provider "${provider.name}" 调用失败!`);
    logger.log('='.repeat(60));
    
    if (error instanceof Error) {
      logger.error(`错误类型: ${error.constructor.name}`);
      logger.error(`错误消息: ${error.message}`);
      
      if (error.status) {
        logger.error(`HTTP 状态码: ${error.status}`);
      }
      
      if (error.code) {
        logger.error(`错误代码: ${error.code}`);
      }
      
      if (error.headers) {
        logger.error(`响应头: ${JSON.stringify(error.headers, null, 2)}`);
      }
    } else {
      logger.error('未知错误:', error);
    }
    
    logger.log('='.repeat(60));
    return false;
  }
}

async function testAllProviders() {
  let successCount = 0;
  
  for (const provider of providers) {
    const success = await testProvider(provider);
    if (success) {
      successCount++;
    }
  }
  
  logger.log('\n' + '='.repeat(60));
  logger.log(`测试完成: ${successCount}/${providers.length} 个provider可用`);
  logger.log('='.repeat(60));
  
  return successCount > 0;
}

testAllProviders().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  logger.error('测试脚本异常:', error);
  process.exit(1);
});
