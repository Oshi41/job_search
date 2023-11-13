import {Awaiter, join_mkfile, Settings} from "oshi_utils";
import {read_settings} from "../backend/utils.js";
import {edge_browser, use_job_info_cb, linkedin_auth, use_reauth, Worker} from "./utils.js";
import {get_jobs_db, get_vacancy_db, update_one} from "../utils.js";
import os from "os";

const settings = new Settings(join_mkfile(os.homedir(), 'job_search', 'scrape_worker.json')).use_fresh(200);

async function read_content(page, selector) {
    let res = await page.$eval(selector, elem => {
        return Array.from(elem.childNodes.values()).map(elem => {
            switch (elem.nodeType) {
                case Node.TEXT_NODE:
                    if (elem.tagName == 'LI') {
                        return '* ' + elem.textContent;
                    }
                    return elem.textContent;
                default:
                    return elem.innerText;
            }
        })
    });
    // read all vacancy text here
    let text = res.slice(1).join('\n').trim();
    // trim language dependant rows here (to avoid other language injection)
    text = text.split('\n').slice(1, -1).join('\n');
    return text;
}

async function process_single_item({job_id, _id}) {
    let cfg = await read_settings();
    let link = 'https://www.linkedin.com/jobs/view/' + job_id;
    let page = await (await edge_browser()).newPage();
    this.finally(() => page.close());

    let awaiter = new Awaiter();
    use_reauth(page);
    use_job_info_cb(page, v=>awaiter.resolve(v));

    page.goto(link);
    let vacancy = awaiter.wait_for(60_000);

    /** @type {Vacancy}*/
    vacancy = await vacancy;
    let db = await get_vacancy_db();
    vacancy.text = await read_content(page, '.jobs-description-content');
    vacancy.easy_apply = !!await page.$(`button[data-job-id="${job_id}"]`);
    await update_one(db, {job_id}, vacancy);
}

const worker = new Worker(
    await get_jobs_db(),
    process_single_item,
    x => ({_id: x._id}));

export async function run() {
    worker.run({type: 'scrape'});
}