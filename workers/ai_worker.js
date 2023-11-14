import {edge_browser, linkedin_auth, use_reauth, Worker} from "./utils.js";
import {get_jobs_db, get_vacancy_db, update_one} from "../utils.js";
import {read_settings} from "../backend/utils.js";
import {Awaiter, join_mkfile, Settings} from "oshi_utils";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * @type {Map<string, (text: string)=>Promise<string>>}
 */
const ask_map = new Map();

async function process_single_item({job_id, question}) {
    let db = await get_vacancy_db();
    let vacancy = await db.findOneAsync({job_id});
    if (!vacancy)
        throw new Error('Cannot find vacancy: '+job_id);

    let settings = await read_settings();
    for (let {name} of settings.ai)
    {
        let fn = ask_map.get(name);
        if (!fn)
        {
            console.warn('[ai_worker] This AI is not supporting: '+name);
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
    await get_vacancy_db(),
    process_single_item,
    x=>({_id: x._id}),
);

export async function run() {
    let dir = path.resolve('workers', 'ais');
    let files = fs.readdirSync(dir).map(x=>path.join(dir, x));
    for (let file of files) {
        let extension = path.extname(file);
        let base_name = path.basename(file, extension);
        let module = await import('file://'+file);
        if (module.ask)
            ask_map.set(base_name, module.ask);
    }

    worker.run({type: 'ai'});
}