import {Awaiter, join_mkfile, Settings, sleep} from "oshi_utils";
import {read_settings} from "../backend/utils.js";
import {edge_browser, use_job_info_cb, linkedin_auth, use_reauth, Worker} from "./utils.js";
import {get_jobs_db, get_vacancy_db, safely_wait_selector, update_one} from "../utils.js";
import os from "os";

const settings = new Settings(join_mkfile(os.homedir(), 'job_search', 'scrape_worker.json')).use_fresh(200);

async function process_single_item({job_id, _id}) {
    let cfg = await read_settings();
    let link = 'https://www.linkedin.com/jobs/view/' + job_id;
    let page = await (await edge_browser()).newPage();
    this.finally(async () => {
        await sleep(200);
        page?.close();
    });

    let awaiter = new Awaiter();
    use_reauth(page, settings, cfg);
    use_job_info_cb(page, v => awaiter.resolve(v));

    page.goto(link);
    let vacancy = awaiter.wait_for(60_000);

    /** @type {Vacancy}*/
    vacancy = await vacancy;
    let db = await get_vacancy_db();
    vacancy.html_content = await page.evaluate((s) => document.querySelector(s).outerHTML,
        '.jobs-box__html-content');
    await update_one(db, {job_id}, vacancy);
}

const worker = new Worker(
    await get_jobs_db(),
    process_single_item,
    x => ({_id: x._id}));

export async function run() {
    worker.run({type: 'scrape'});
}