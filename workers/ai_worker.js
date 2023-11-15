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
export async function read_ai_cfg() {
    let default_config = [
        {name: 'you', max: 10_000},
        {name: 'bard', max: 5_000}, // looks like it's lacking context if message is too long
        {name: 'gpt', max: 5_000}, // 8k tokens is max, so lower the char amount
        // {name: 'bing', max: 10_000}, // disable them now
        // {name: 'claude', max: 10_000, use: false},
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
 * @param ais {{name: string}[]}
 * @returns {Promise<{name: string}[]>}
 */
async function sort_ais(ais) {
    let jobs_db = await get_jobs_db();
    let jobs = await jobs_db.findAsync({type: 'ai', ai: {$exists: true}})
        .sort({end: -1}).projection({ai: 1});
    jobs = Array.from(new Set(jobs.map(x => x.ai)));

    if (jobs.length) {
        jobs = jobs.reverse();
        let rest = ais.map(x => x.name).filter(x => !jobs.includes(x));
        rest.concat(jobs);
        rest.map(x => ais.find(a => a.name == x));
    }

    return ais;
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

    let ais = await read_ai_cfg();
    ais = ais.filter(({name, max, use}) => {
        if (!ask_map.has(name)) {
            console.warn('[ai_worker] This AI is not supporting: ' + name);
            return false;
        }

        if (question.length > max) {
            console.log(`[ai_worker] Skipping ${name} as message is bigger than limit (${question.length} < ${max})`);
            return false;
        }

        if (use === false) {
            console.log(`[ai worker] Skipping ${name} as it's disabled`);
            return false;
        }

        return true;
    });
    ais = await sort_ais(ais);

    for (let {name} of ais) {
        try {
            let fn = ask_map.get(name);
            let ai_resp = await fn(question);
            if (!ai_resp)
                throw new Error('empty ai resp');

            let percentage = +/\d+%/g.exec(ai_resp)?.[0]?.replace('%', '')?.trim() || 0;
            await update_one(db, {job_id}, {ai_resp, percentage});
            this.append2job({ai: name}); // saving used AI
            return;
        } catch (e) {
            console.warn('Error during AI resp:', e);
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