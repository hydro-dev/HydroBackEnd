import { STATUS } from '@hydrooj/utils/lib/status';
import { runFlow } from '../flow';
import { Parameter, runPiped } from '../sandbox';
import signals from '../signals';
import { NormalizedCase } from '../utils';
import { Context, ContextSubTask } from './interface';

function judgeCase(c: NormalizedCase) {
    return async (ctx: Context, ctxSubtask: ContextSubTask) => {
        const { address_space_limit, process_limit } = ctx.session.getLang(ctx.lang);
        let managerArgs = '';
        const execute: Parameter[] = [{
            execute: ctx.executeManager.execute,
            stdin: c.input ? { src: c.input } : { content: '' },
            copyIn: ctx.executeManager.copyIn,
            time: c.time * 2,
            memory: c.memory * 2,
            env: { ...ctx.env, HYDRO_TESTCASE: c.id.toString() },
        }];
        const pipeMapping = [];
        for (let i = 0; i < ctx.config.num_processes; i++) {
            managerArgs += ` /proc/self/fd/${i * 2 + 3} /proc/self/fd/${i * 2 + 4}`;
            execute.push({
                execute: `${ctx.executeUser.execute} ${i}`,
                copyIn: ctx.executeUser.copyIn,
                time: c.time,
                memory: c.memory,
                addressSpaceLimit: address_space_limit,
                processLimit: process_limit,
            });
            pipeMapping.push({
                in: { index: i + 1, fd: 1 },
                out: { index: 0, fd: i * 2 + 3 },
            });
            pipeMapping.push({
                in: { index: 0, fd: i * 2 + 4 },
                out: { index: i + 1, fd: 0 },
            });
        }
        execute[0].execute += managerArgs;
        const res = await runPiped(execute, pipeMapping);
        console.info(res);
        const resManager = res[0];
        let time = 0;
        let memory = 0;
        let score = 0;
        let status = STATUS.STATUS_ACCEPTED;
        let message: any;
        const detail = ctx.config.detail ?? true;
        for (let i = 0; i < ctx.config.num_processes; i++) {
            const result = res[i + 1];
            time += result.time;
            memory = Math.max(memory, result.memory);
            if (result.time > c.time) status = STATUS.STATUS_TIME_LIMIT_EXCEEDED;
            else if (result.memory > c.memory * 1024) status = STATUS.STATUS_MEMORY_LIMIT_EXCEEDED;
            else if ((result.code && result.code !== 13 /* Broken Pipe */) || (result.code === 13 && !resManager.code)) {
                status = STATUS.STATUS_RUNTIME_ERROR;
                if (detail) {
                    if (result.code < 32 && result.signalled) message = signals[result.code];
                    else message = { message: 'Your program returned {0}.', params: [result.code] };
                }
            }
        }
        if (status === STATUS.STATUS_ACCEPTED) {
            console.info(resManager.stdout, resManager.stderr);
            score = 100;
            // { status, score, message } = parseManagerMessage(resManager.stderr, c.score);
            if (resManager.code && !(resManager.stderr || '').trim().length) message += ` (Manager exited with code ${resManager.code})`;
        }
        return {
            id: c.id,
            subtaskId: ctxSubtask.subtask.id,
            status,
            score,
            time,
            memory,
            message,
        };
    };
}

export const judge = async (ctx: Context) => await runFlow(ctx, {
    compile: async () => {
        [ctx.executeUser, ctx.executeManager] = await Promise.all([
            ctx.compile(ctx.lang, ctx.code),
            ctx.compileLocalFile('manager', ctx.config.manager),
        ]);
    },
    judgeCase,
});
