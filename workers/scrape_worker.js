import {Awaiter, join_mkfile, Queue, Settings} from "oshi_utils";
import {read_settings} from "../backend/utils.js";
import {edge_browser, linkedin_auth} from "./utils.js";
import {get_jobs_db, get_vacancy_db, update_one} from "../utils.js";
import fs from "fs";
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
    let job_db = await get_jobs_db();
    await update_one(job_db, {_id}, {start: new Date()});

    let cfg = await read_settings();
    let link = 'https://www.linkedin.com/jobs/view/' + job_id;
    let page = await (await edge_browser()).newPage();
    let awaiter = new Awaiter();
    let vacancy = awaiter.wait_for(60_000);
    const on_finish = error => {
        page?.close();
        let upd = {end: new Date()};
        if (error)
            upd.error = error;
        return update_one(job_db, {_id}, upd);
    };

    this.then(on_finish);
    this.catch(on_finish);

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
                awaiter.resolve(vacancy);
            }
        }

        if (url?.includes?.('api/metadata/user')) {
            try {
                let {client: {isUserLoggedIn}} = await resp.json();
                settings.linkedin_auth = !!isUserLoggedIn;
            } catch (e) {
                // ignored
            }
        }
    });

    await page.goto(link, {waitUntil: 'load'});
    if (!settings.linkedin_auth) {
        await page.goto('https://www.linkedin.com/uas/login', {waitUntil: 'load'});
        if (await linkedin_auth(page, cfg))
            await page.goto(link, {waitUntil: 'load'});
    }

    /** @type {Vacancy}*/
    vacancy = await vacancy;
    let db = await get_vacancy_db();
    vacancy.text = await read_content(page, '.jobs-description-content');
    vacancy.easy_apply = !!await page.$(`button[data-job-id="${job_id}"]`);
    await update_one(db, {job_id}, vacancy);
}

let queue = new Queue(process_single_item);

export async function run() {
    let db = await get_jobs_db();
    let queued = await db.findAsync({
        type: 'scrape',
        end: {$exists: false},
    });
    // install prev tasks
    queue.push(...queued);

    fs.watchFile(db.filename, {interval: 200}, async () => {
        let queued = queue.queue.map(x => x._id);
        /** @type {Job[]}*/
        let tasks = await db.findAsync({
            scheduled: {$exists: false},
            start: {$exists: false},
            end: {$exists: false},
            type: 'scrape',
        });
        if (!tasks.length)
            return;
        queue.push(...tasks);

        for (let {job_id} of tasks)
            await update_one(db, {job_id}, {scheduled: new Date()});
    });
}