import {get_puppeteer, get_vacancy_db, handler, update_one} from "../utils.js";
import {Awaiter, Queue} from "oshi_utils";

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

async function scrape_vacancy(job_id) {
    let db = await get_vacancy_db();
    let vacancy = await db.find({job_id: +job_id});
    if (!vacancy)
        return void console.error(`Requested to scrape ${job_id} which is not existing in database`);
    let awaiter = new Awaiter();

    let browser = await get_puppeteer();
    const page = await browser.newPage();
    setup_listener(page, async vacancy => {
        await update_one(db, {job_id: vacancy.job_id}, vacancy);
        awaiter.resolve(vacancy);
    });
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
    app.post('/scrape', handler(async req => {
        let job_id = +req.body;
        if (!Number.isInteger(job_id))
            throw Object.assign(new Error('Wrong job ID provided'), {code: 400});
        let db = await get_vacancy_db();
        if (await db.countAsync({job_id}) < 1)
            throw Object.assign(new Error('Such job ID not found in Database'), {code: 400});
        if (!queue.queue.includes(job_id)) {
            queue.push(job_id);
        }
        return true;
    }));
}
