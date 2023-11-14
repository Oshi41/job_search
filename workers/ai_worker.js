import {edge_browser, linkedin_auth, use_reauth, Worker} from "./utils.js";
import {get_jobs_db, get_vacancy_db, update_one} from "../utils.js";
import {read_settings} from "../backend/utils.js";
import {_, Awaiter, join_mkfile, Settings} from "oshi_utils";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * @type {Map<string, (text: string)=>Promise<string>>}
 */
const ask_map = new Map();

/** @returns {Promise<{name: string, use: boolean, max: number}[]>}*/
async function read_ai_cfg() {
    let default_config = [
        {name: 'you', max: 10_000},
        {name: 'gpt', max: 5_000}, // 8k tokens is max, so lower the char amount
        {name: 'bing', max: 10_000},
        {name: 'claude', max: 10_000, use: false}, // disable for now
    ];
    const {ai} = await read_settings();
    const result = [];
    for (let name of default_config.map(x => x.name)) {
        let src = ai?.find(x => x.name == name) || {};
        let from = default_config.find(x => x.name == name);
        result.push(_.assign(src, from));
    }
    return result;
}

/**
 * @param job_id {number}
 * @param question {string}
 * @returns {Promise<void>}
 */
async function process_single_item({job_id, question}) {
    let db = await get_vacancy_db();
    let vacancy = await db.findOneAsync({job_id});
    if (!vacancy)
        throw new Error('Cannot find vacancy: ' + job_id);

    for (let {name, max, use} of await read_ai_cfg()) {
        let fn = ask_map.get(name);
        if (!fn) {
            console.warn('[ai_worker] This AI is not supporting: ' + name);
            continue;
        }
        if (question.length > max) {
            console.log(`[ai_worker] Skipping ${name} as message is bigger than limit (${question.length} < ${max})`);
            continue;
        }
        if (use === false) {
            console.log(`[ai worker] Skipping ${name} as it's disabled`);
            continue;
        }
        try {
            let ai_resp = await fn(question);
            if (!ai_resp)
                throw new Error('empty ai resp');

            let percentage = +/\d+%/g.exec(ai_resp)?.[0]?.replace('%', '')?.trim() || 0;
            await update_one(db, {job_id}, {ai_resp, percentage});
            return;
        } catch (e) {
            // ignored
        }
    }

    throw new Error('Cannot get AI response');
}

const worker = new Worker(
    await get_jobs_db(),
    process_single_item,
    x => ({_id: x._id}),
);

export async function run() {
    let dir = path.resolve('workers', 'ais');
    let files = fs.readdirSync(dir).map(x => path.join(dir, x));
    for (let file of files) {
        let extension = path.extname(file);
        let base_name = path.basename(file, extension);
        let module = await import('file://' + file);
        if (module.ask)
            ask_map.set(base_name, module.ask);
    }

    worker.run({type: 'ai'});
}