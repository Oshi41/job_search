import {edge_browser, use_job_info_cb, use_reauth, Worker} from "./utils.js";
import {get_jobs_db, get_vacancy_db, safely_wait_idle, safely_wait_selector, update_one} from "../utils.js";
import {read_settings} from "../backend/utils.js";
import {Awaiter, join_mkfile, Settings, sleep} from "oshi_utils";
import os from "os";
import {analyze} from "../backend/report_server.js";

const settings = new Settings(join_mkfile(os.homedir(), 'job_search', 'scrape_worker.json')).use_fresh(200);

/**
 * @param page {Page}
 * @param job_id {number}
 * @returns {Promise<void>}
 */
async function read_job_card(page, job_id) {
    let selector;
    if (Number.isInteger(job_id)) {
        selector = `li[data-occludable-job-id="${job_id}"]`;
        /** @type {ElementHandle}*/
        let job_card = await page.$(selector);
        if (job_card)
        {
            await job_card.scrollIntoView()
            await job_card.click();
            await safely_wait_idle(page, 1);
        } else {
            console.warn('Cannot find clickable Job card for', job_id);
        }
    }

    selector = '.jobs-box__html-content';
    if (await safely_wait_selector(page, selector, 4)) {
        let html_content = await page.evaluate(
            (s) => document.querySelector(s).outerHTML,
            selector);
        return html_content;
    }
}

async function process_job(job) {
    let cfg = await read_settings();
    let db = await get_vacancy_db();
    let page = await (await edge_browser()).newPage();
    this.finally(() => page.close());
    use_reauth(page, settings, cfg);
    let loaded_jobs = new Map();
    use_job_info_cb(page, async v => {
        loaded_jobs.set(+v.job_id, v);
        console.debug('vacancy loaded via API', v.job_id);
    });

    let awaiter = new Awaiter();
    page.on('response', async resp => {
        let url = resp?.url?.();
        if (url?.includes?.('voyagerJobsDashJobCards')) {
            try {
                let {data} = await resp.json();
                let paging = data.paging;
                let job_ids = data.elements.map(x => {
                    /** @type {string}*/
                    let str = Object.values(x.jobCardUnion).find(x => x.includes('jobPostingCard'));
                    let number = +str?.split(':')?.pop()?.slice(1, -1)?.split(',')?.[0];
                    return number;
                }).filter(Number.isInteger);
                awaiter.resolve({
                    job_ids,
                    paging,
                });
            } catch (e) {
                // ignored
            }
        }
    });

    /**
     * Scans single vacancy page
     * @param page {Page}
     * @param _url {URL}
     * @returns {Promise<{paging: {total: number, count: number} | undefined}>}
     */
    async function scrape_single_page(page, _url) {
        page.goto(_url.toString());
        let res;
        try {
            res = await awaiter.wait_for(60_000);
        } catch (e) {
            return void console.error('Error during url scraping:', url.toString());
        }

        // as we do not waiting for page.goto
        await safely_wait_idle(page, 2);

        let {job_ids, paging: {count, total}} = res;
        // first page
        for (let job_id of job_ids)
        {
            let html_content = await read_job_card(page, job_id);
            if (!loaded_jobs.has(+job_id))
            {
                console.debug('wait for API interception for', job_id);
                await safely_wait_idle(page, 2);
            }
            if (loaded_jobs.has(+job_id))
            {
                await update_one(db, {job_id: +job_id}, {
                    ...loaded_jobs.get(+job_id),
                    html_content,
                });
                console.debug('saved', job_id);
                analyze(await db.findOneAsync({job_id: +job_id}));
            } else {
                console.debug('skipping as no API interception found', job_id);
            }
        }
        return res;
    }

    let {url} = job;
    url = new URL(url);
    let res = await scrape_single_page(page, url);
    if (!res)
        return;

    let {paging: {total, count}} = res;

    // 2 to last page
    for (let i = count; i < total; i+=count) {
        console.debug('navigating to page', i/count+1);
        url.searchParams.set('start', i);
        res = await scrape_single_page(page, url);
        if (!res)
            break;

        total = res.paging.total;
        count = res.paging.count;
    }
}

const worker = new Worker(await get_jobs_db(), process_job, x => ({_id: x._id}));

export async function run() {
    worker.run({type: 'scrape_search'});
}