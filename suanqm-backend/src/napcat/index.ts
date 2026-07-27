import { NCWebsocket } from 'node-napcat-ts'
import { getConfig } from '../config/index.js'

const napcatConfig = getConfig().napcat;

if (!napcatConfig) {
  throw new Error('Napcat 配置未在 config/config.json 中定义');
}

const napcat = new NCWebsocket({
  protocol: napcatConfig.protocol,
  host: napcatConfig.host,
  port: napcatConfig.port,
  accessToken: napcatConfig.accessToken,
  throwPromise: napcatConfig.throwPromise,
  reconnection: napcatConfig.reconnection
}, napcatConfig.debug)

export default napcat