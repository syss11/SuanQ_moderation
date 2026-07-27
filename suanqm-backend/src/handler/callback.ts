import { Simplified_Messages } from "../server/utils/suanq_types";

class HandlerCallback {
    groupId: number;
    userId: number;
    callback: (message: Simplified_Messages) => Promise<void>; 
    once: boolean = false;
    
    constructor(groupId: number, userId: number, callback: (message: Simplified_Messages) => Promise<void>, once: boolean = false) {
        this.groupId = groupId;
        this.userId = userId;
        this.callback = callback;
        this.once = once;
    }

}

class HandlerCallbackManager {
    callbacks: HandlerCallback[] = [];

    async handle_custom_callback(message: Simplified_Messages) {
        if (message.message_type !='group') {
            return;
        }
        
        const callbacks = this.callbacks.filter(c => c.groupId == message.group_id && c.userId == message.user_id);
        
        for (const callback of callbacks) {
            await callback.callback(message);
            if (callback.once) {
                this.callbacks = this.callbacks.filter(c => c !== callback);
            }
        }
    }

    register_callback(groupId: number, userId: number, callback: (message: Simplified_Messages) => Promise<void>, once: boolean = false) {
        
        this.callbacks.push(new HandlerCallback(groupId, userId, callback, once));
    }
}

export const callbackManager = new HandlerCallbackManager();