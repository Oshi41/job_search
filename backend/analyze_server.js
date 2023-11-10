import path from "path";
import fs from "fs";
import {get_vacancy_db, handler, update_one} from "../utils.js";
import * as ai from "../ai/bing.js";
import {use_settings_mw, use_vacancy_mw} from "./utils.js";
import {Queue} from "oshi_utils";
import {build_resume} from "../resume_bulider.js";

let cfg;
export const ai_queue = new Queue(process_single_item);

async function process_single_item(vacancy){
    await ai.init();
    let prompt = 'Your role is HR helper. You will need to read resume and vacancy text below and ' +
        'find out how this job is suitable for both job seeker and recruiter. Your response must contain ' +
        'compatibility percentage (0-100%), newline, provide desired vacancy stack I have (list with bullets), ' +
        'newline, vacancy stack I do not have (list with bullets), newline, salary is mentioned, newline, ' +
        'can job provide work/visa/relocation if mentioned, newline, job location if mentioned, newline, ' +
        'company name and what is it doing (very shortly), newline, what should I do at this role (shortly). '
        + cfg?.prompt;
    let resume_txt = fs.readFileSync(path.resolve(await build_resume(), '..', 'resume.txt'), 'utf-8');
    let all_prompt = [prompt, vacancy.text, resume_txt].join('\n\n');
    let resp = await ai.ask(all_prompt);
    let percentage = +/\d+%/g.exec(resp)?.[0]?.replace('%', '')?.trim() || 0;
        if (percentage > 0)
        await build_resume(percentage); // create resume to send
    let db = await get_vacancy_db()
    await update_one(db, {job_id: +vacancy.job_id}, {ai_resp: resp, percentage, prompt});

}

/**
 * @param app {Express}
 */
export async function install(app) {
    app.post('/analyze', use_vacancy_mw, use_settings_mw, handler(async req => {
        const {vacancy, db, settings} = req;
        cfg = settings;
        if (!ai_queue.queue.some(x=>x.job_id == vacancy.job_id))
            ai_queue.push(vacancy);
        return true;
    }));
}