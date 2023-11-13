import {
    get_puppeteer,
    safely_wait_idle,
    user_typing,
    wait_rand,
    get_vacancy_db,
    update_one, try_linkedin_auth, safely_wait_selector
} from "./utils.js";
import {Awaiter, date, sleep} from "oshi_utils";

/**
 * @param page {Page}
 * @param selector {string} - content selector we want to retrive text
 * @param use_recognition {boolean}
 * @returns {Promise<string>}
 */
async function read_content(page, selector, {use_recognition = false} = {}) {
    if (!use_recognition) {
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
    } else {

    }
}

/**
 * @param page {Page}
 * @returns {Promise<string>}
 */
async function scrape_search_results(page, max_page, meta, {on_vacancy_founded} = {}) {
    let buttons_count = 1, pagination_sel = '.artdeco-pagination__pages--number';
    console.debug('waiting for paginator');

    if (await safely_wait_selector(page, pagination_sel, 5)) {
        buttons_count = await page.$eval(pagination_sel, x => Array.from(x.childNodes.values())
            .filter(n => n.id).map(n => ({id: n.id})).length);
    }
    let db = await get_vacancy_db();

    async function scape_single_vacancy({selector, job_id}) {
        let vacancy = await page.$(selector); // li
        await vacancy.scrollIntoView();
        console.debug('Scrolled to vacancy');
        await wait_rand(576);
        await vacancy.click();
        console.debug('Clicked on vacancy, waiting for page loading');

        await safely_wait_idle(page, 2);

        let link = 'https://www.linkedin.com/jobs/view/' + job_id;
        selector = '.jobs-description-content';

        let text = await read_content(page, selector);
        console.debug('Read vacancy content');
        text = text.replace(/\n\n+/g, '\n\n');
        let easy_apply = await page.$(`button[data-job-id="${job_id}"]`);
        console.debug('Checked for easy apply');

        if (await db.countAsync({job_id, text}) > 0) {
            console.debug('Skipping job', job_id, 'as it already loaded');
            return;
        }

        await update_one(db, {job_id: +job_id}, {
            link,
            text,
            easy_apply: !!easy_apply,
            ...(meta || {}),
        });
    }

    async function scrape_single_page(page_id) {
        if (page_id > 1) {
            let btn = await page.$(pagination_sel + ` > [data-test-pagination-page-btn="${page_id}"]`);
            if (!btn)
                return;
            await btn.click();
            console.debug('clicked', page_id, 'pagination button and wait for page loading');
            await safely_wait_idle(page, 5);
        }

        let container = await page.$('.scaffold-layout__list-container');
        /**
         * @type {{selector: string, job_id: number}[]}
         */
        let map = await container.$$eval('li.ember-view', arr => {
            return arr.map(x => {
                let id = x.id, job_id;
                for (let i = 0; i < x.attributes.length; i++) {
                    let attr = x.attributes.item(i);
                    if (/job.+id/.test(attr.name)) {
                        job_id = +attr.value;
                        break;
                    }
                }
                return {
                    selector: 'li#' + id,
                    job_id
                };
            });
        });
        map = map.filter(x => Number.isInteger(x.job_id));
        console.debug('Founded', map.length, 'vacancies on', page_id, 'page');

        while (map.length) {
            try {
                await scape_single_vacancy(map[0]);
                map.shift();
            } catch (e) {
                console.debug('Error during vacancy scrape:', e);
                await wait_rand(578);
            }
        }
    }

    let i = 1, end = Math.min(buttons_count, max_page);

    while (i <= end) {
        try {
            await scrape_single_page(i);
            i++;
        } catch (e) {
            console.warn('Error during pagination:', e);
            await wait_rand(568);
        }
    }
}

/**
 * @param page {Page}
 * @param db {Nedb<Vacancy>}
 * @param cb {(Response)=>Promise}
 * @returns {Promise<void>}
 */
function listen_for_job_description(page, db, cb = undefined) {
    page.on('response', async resp => {
        let url = resp?.url?.();
        if (url?.includes?.('voyager/api/jobs/jobPostings/')) {
            let job_info;
            try {
                job_info = await resp.json();
            } catch (e) {
                // ignored
                console.debug('No JSON resp:', e);
                return
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
                await update_one(db, {job_id: +job_id}, {
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
                });
                await cb?.(resp, job_id);
                console.debug('Updated job', job_id);
            }
        }
    });
}

/**
 * @param settings {JobSearchSettings}
 * @returns {Promise<Vacancy[]>}
 */
export async function perform_scrape(settings, opt) {
    let browser = await get_puppeteer();
    const page = await browser.newPage();
    /** @type {CDPSession} */
    const client = await page.target().createCDPSession();
    let db = await get_vacancy_db();

    listen_for_job_description(page, db);

    await page.goto('https://www.linkedin.com/uas/login',
        {waitUntil: 'load'});
    await try_linkedin_auth(page, settings);
    await wait_rand(574);

    for (let search_txt of settings.searches) {
        let url = new URL('https://www.linkedin.com/jobs/search');
        url.searchParams.append('keywords', search_txt);
        url.searchParams.append('location', settings.location);

        console.debug('navigate to user search');
        await page.goto(url.toString(), {waitUntil: 'load'});
        console.debug('job scanning');
        await scrape_search_results(page, 5, {search_txt}, opt);
    }
    return true;
}

/**
 * Refresh data with visiting page
 * @param settings {JobSearchSettings}
 * @returns {Promise<void>}
 */
export async function update_vacancies(settings) {
    let browser = await get_puppeteer();
    let db = await get_vacancy_db();

    let page, headers, url, awaiter;
    async function install_page() {
        /** @type {Page}*/
        page = await browser.newPage();
        headers = null;
        url = null;
        awaiter = new Awaiter();
        listen_for_job_description(page, db, async (response, job_id) => {
            console.debug('Sniffing headers');
            headers = response.headers();
            url = response.url().replace(job_id + '', '%s');
            awaiter.resolve(true);
        });

        await page.goto('https://www.linkedin.com/uas/login',
            {waitUntil: 'load'});
        await try_linkedin_auth(page, settings);
        return page;
    }

    page = await install_page();


    /** @type {Vacancy[]}*/
    let elems = await db.find({});
    let $lte = date.add(new Date(), {day: -1});
    elems = elems.filter(x => (!x.applied_time || x.applied_time.valueOf() != 0)
        && !(x.last_refresh || x.last_refresh <= $lte));
    console.debug('Will update', elems.length, 'vacancies');
    if (!elems.length)
        return;

    for (let vacancy of elems) {
        let res = page.goto(vacancy.link);
        let was_changed = await Promise.race([
            awaiter.wait_for().then(x=>true),
            sleep(1000*10).then(x=>false)
        ]);
        if (!was_changed)
        {
            res = await res;
            if (200 <= res.status() && res.status() < 300)
            {
                // missing page
                await db.update({job_id: +vacancy.job_id}, {$set: {last_refresh: new Date(), applied_time: new Date(0)}});
            } else {
                await sleep(1000*30); // caught 429, need to wait
            }
        } else {
            // to prevent 429
            await sleep(1000*5);
        }
    }
    console.debug('Finished updating');
}