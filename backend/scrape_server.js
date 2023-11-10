import {
    get_puppeteer,
    get_vacancy_db,
    handler,
    safely_wait_selector, try_linkedin_auth,
    update_one,
    user_typing,
    wait_rand
} from "../utils.js";
import {Awaiter, Queue, Settings} from "oshi_utils";
import {settings_path} from "./settings_server.js";
import {use_vacancy_mw} from "./utils.js";

let settings = new Settings(settings_path);

/**
 * @param page {Page}
 * @param callback {(Vacancy)=>Promise<void>}
 * @returns {void}
 */
export async function setup_listener(page, callback) {
    page.on('response', async resp => {
        let url = resp?.url?.();
        if (url?.includes?.('voyager/api/jobs/jobPostings/')) {
            let job_info;
            try {
                job_info = await resp.json();
            } catch (e) {
                // ignored
                console.debug('No JSON resp:', e);
                return;
            }

            let employ_status = job_info?.data?.employmentStatus?.split(':')?.pop();
            let vacancy_time = new Date(job_info?.data?.originalListedAt || 0);
            let applies = job_info?.data?.applies || 0;
            let location = job_info?.data?.formattedLocation;
            let job_id = +new URL(url).pathname.split('/').pop();
            let applied_time = job_info?.included?.find(x => Number.isFinite(x.appliedAt))?.appliedAt;
            let {name: company_name, url: company_link} = job_info?.included
                ?.find(x => x.$type == 'com.linkedin.voyager.organization.Company') || {};
            applied_time = Number.isFinite(applied_time) ? new Date(applied_time) : null;
            if (job_info?.data?.jobState == 'CLOSED' && !applied_time) {
                // cancelled
                applied_time = new Date(0);
            }

            if (Number.isInteger(job_id)) {
                let vacancy = {
                    job_id: +job_id,
                    link: 'https://www.linkedin.com/jobs/view/' + job_id,
                    employ_status,
                    vacancy_time,
                    applies,
                    location,
                    applied_time,
                    company_name,
                    company_link,
                    raw_job_info: JSON.stringify(job_info),
                    last_refresh: new Date(),
                };
                await callback?.(vacancy);
            }
        }
    });
}

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

async function scrape_vacancy(job_id) {
    let db = await get_vacancy_db();
    /** @type {Vacancy}*/
    let vacancy = await db.findOneAsync({job_id: +job_id});
    if (!vacancy)
        return void console.error(`Requested to scrape ${job_id} which is not existing in database`);
    let awaiter = new Awaiter();

    let browser = await get_puppeteer();
    const page = await browser.newPage();

    try {
        setup_listener(page, async vacancy => {
            await update_one(db, {job_id: vacancy.job_id}, vacancy);
            awaiter.resolve(vacancy);
        });

        await page.goto('https://www.linkedin.com/uas/login', {waitUntil: 'load'});
        if (await safely_wait_selector(page, 'button.btn__primary--large', 2))
        {
            // need to auth
            if (!settings)
                throw new Error('No settings provided');
            let cfg = await settings.read();
            await try_linkedin_auth(page, cfg);
        }

        await page.goto(vacancy.link, {waitUntil: 'load'});
        let text = await read_content(page, '.jobs-description-content');
        console.debug('Read vacancy content');
        let easy_apply = !!await page.$(`button[data-job-id="${job_id}"]`);
        await update_one(db, {job_id}, {text, easy_apply,});
        console.debug('updated vacancy text');
    } finally {
        page.close();
    }
}

/**
 * Scraping queue
 * @type {Queue}
 */
export const queue = new Queue(scrape_vacancy);

/**
 * @param app {Express}
 */
export function install(app) {
    app.post('/scrape', use_vacancy_mw, handler(async req => {
        let job_id = req.vacancy.job_id;
        if (!queue.queue.includes(job_id)) {
            queue.push(job_id);
        }
        return true;
    }));
}
