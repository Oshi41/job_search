import {
    get_puppeteer,
    safely_wait_idle,
    user_typing,
    wait_rand,
    get_vacancy_db,
    update_one, try_linkedin_auth
} from "./utils.js";

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
        return res.slice(1).join('\n');
    } else {

    }
}

/**
 * @param page {Page}
 * @returns {Promise<string>}
 */
async function scrape_search_results(page, max_page, meta, {on_vacancy_founded} = {}) {
    let pagination_sel = '.artdeco-pagination__pages--number';
    console.debug('waiting for paginator');
    await page.waitForSelector(pagination_sel);
    let buttons_count = await page.$eval(pagination_sel, x => Array.from(x.childNodes.values())
        .filter(n => n.id).map(n => ({id: n.id})).length);
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
        let btn = await page.$(pagination_sel + ` > [data-test-pagination-page-btn="${page_id}"]`);
        if (!btn)
            return;

        await btn.click();
        console.debug('clicked', page_id, 'pagination button and wait for page loading');
        await safely_wait_idle(page, 5);

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
 * @param settings {JobSearchSettings}
 * @returns {Promise<Vacancy[]>}
 */
export default async function main(settings, opt) {
    let browser = await get_puppeteer();
    const page = await browser.newPage();
    /** @type {CDPSession} */
    const client = await page.target().createCDPSession();
    let db = await get_vacancy_db();

    page.on('response', async resp => {
        let url = resp?.url?.();
        if (url?.includes?.('voyager/api/jobs/jobPostings/')) {
            let job_info = await resp.json();

            let employ_status = job_info?.data?.employmentStatus?.split(':')?.pop();
            let vacancy_time = new Date(job_info?.data?.originalListedAt || 0);
            let applies = job_info?.data?.applies || 0;
            let location = job_info?.data?.formattedLocation;
            let job_id = +new URL(url).pathname.split('/').pop();
            let applied_time = job_info?.included?.find(x=>Number.isFinite(x.appliedAt))?.appliedAt;
            applied_time = Number.isFinite(applied_time) ? new Date(applied_time) : null;

            if (Number.isInteger(job_id)) {
                await update_one(db, {job_id: +job_id}, {
                    link: 'https://www.linkedin.com/jobs/view/' + job_id,
                    employ_status,
                    vacancy_time,
                    applies,
                    location,
                    applied_time,
                });
                console.debug('Updated job', job_id);
            }
        }
    });

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