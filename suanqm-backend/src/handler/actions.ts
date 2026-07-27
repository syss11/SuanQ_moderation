import VioPunish from "./vio_punish.js";
import { remind_recall_and_forward } from "../character/behavior.js";
import { logger } from "../logger.js";



class ActionManager{
    public actions: VioPunish[] = [];
    public history_actions: VioPunish[] = [];

    add_action(action: VioPunish){
        this.actions.push(action);
    }

    async execute_all(){
        this.merge_viopunish();
        let already_mute = { s:0 }
        for (const action of this.actions) {
            await action.execute(this.history_actions, already_mute);
        }
    }

    get_pending_count(): number {
        return this.actions.length;
    }

    merge_viopunish(){
        const originalCount = this.actions.length;
        // logger.debug(`[Merge] 合并前 action 数量: ${originalCount}`);

        const mergedMap = new Map<string, VioPunish>();

        for (const action of this.actions) {
            const key = `${action.userid}_${action.penalty_type}_${action.violation_type}`;
            const existing = mergedMap.get(key);

            if (existing) {
                logger.debug(`[Merge] 合并相同 key: ${key}`);
                existing.penalty_time = Math.max(existing.penalty_time, action.penalty_time);
                existing.severity = Math.max(existing.severity || 0, action.severity || 0);
                existing.credit_deduction = Math.max(existing.credit_deduction || 0, action.credit_deduction || 0);
                if (action.callback && !existing.callback) {
                    existing.callback = action.callback;
                }
            } else {
                mergedMap.set(key, action);
            }
        }

        this.actions = Array.from(mergedMap.values());
        // logger.debug(`[Merge] 合并后 action 数量: ${this.actions.length}, 合并了 ${originalCount - this.actions.length} 个`);
    }

    clear_all(){
        this.history_actions = [...this.history_actions.filter(action => action.create_time > Math.floor(Date.now() / 1000) - 5), ...this.actions];
        this.actions = [];
    }

    
}
export default new ActionManager();

import napcat from '../napcat/index.js'
import { Simplified_Messages } from "../server/utils/suanq_types.js";

export async function recall_and_forward(
    message: Simplified_Messages,
    group_id: number,
    enable_ai?: boolean,
    extra_prompt?:string
){
    try{
        await napcat.send_forward_msg({
            group_id,
            message: [{
                type: 'node',
                data: {
                    id: String(message.message_id)
                }
            }]
        })
        await napcat.delete_msg({
            message_id: message.message_id
        });
        if (enable_ai) {
            await remind_recall_and_forward(message,extra_prompt);
        }
    }catch(error){
        logger.error('转发消息失败:', error);
    }
}