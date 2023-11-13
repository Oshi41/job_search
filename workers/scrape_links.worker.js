import {edge_browser, linkedin_auth, use_reauth, Worker} from "./utils.js";
import {get_jobs_db} from "../utils.js";
import {read_settings} from "../backend/utils.js";
import {Awaiter, join_mkfile, Settings} from "oshi_utils";
import os from "os";

const settings = new Settings(join_mkfile(os.homedir(), 'job_search', 'scrape_worker.json')).use_fresh(200);

async function process_job(job){
    let cfg = await read_settings();
    let page = await (await edge_browser()).newPage();
    this.finally(() => page.close());
    use_reauth(page, settings, cfg);

    let awaiter = new Awaiter();
    page.on('response', async resp => {
        let url = resp?.url?.();
        if (url?.includes?.('voyagerJobsDashJobCards')) {
            try {
                let {data: {paging: {total}}} = await resp.json();
                awaiter.resolve(total);
            } catch (e) {
                // ignored
            }
        }
    });

    for (let [key, {url}] of Object.entries(job.links))
    {
        page.goto(url);
        let total = await awaiter.wait_for(60_000);
        this.append2job({links: {[key]: {total, url}}});
    }
}

const worker = new Worker(await get_jobs_db(), process_job, x => ({_id: x._id}));

export async function run() {
    worker.run({type: 'scrape_links'});
}