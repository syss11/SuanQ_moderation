import { NCWebsocket,AllHandlers,SocketHandler,ApiHandler,MessageHandler,MessageSentHandler,MetaEventHandler,RequestHandler,NoticeHandler } from "node-napcat-ts";


class SqAdapter{
    private napcat:NCWebsocket
    private isTestMode:boolean
    public registeredHandlers: SqHandler[]

    constructor(_napcat:NCWebsocket, isTestMode:boolean = false){
        this.napcat=_napcat
        this.isTestMode = isTestMode
        this.registeredHandlers = []
    }
    
    register_handlers(handlers:SqHandler[]){
        this.registeredHandlers = handlers
        
        if (!this.isTestMode) {
            handlers.forEach((handler)=>{
                this.napcat.on(handler.bind_event,handler.func)
            })
        }
    }
    
    // 测试模式下获取注册的处理器列表
    getHandlers(): SqHandler[] {
        return this.registeredHandlers
    }
    
    // 测试模式下手动触发事件
    emitEvent(eventName: string, context: any) {
        if (this.isTestMode) {
            const handler = this.registeredHandlers.find(h => h.bind_event === eventName)
            if (handler) {
                return handler.func(context)
            }
        }
    }
}

class SqHandler{
    public bind_event: keyof SocketHandler | keyof ApiHandler | keyof MessageHandler | keyof MessageSentHandler | keyof MetaEventHandler | keyof RequestHandler | keyof NoticeHandler
    public func:any

    constructor(bind_event :keyof SocketHandler | keyof ApiHandler | keyof MessageHandler | keyof MessageSentHandler | keyof MetaEventHandler | keyof RequestHandler | keyof NoticeHandler,func:any){
        this.bind_event=bind_event
        this.func=func
    }
}


export {SqAdapter,SqHandler}