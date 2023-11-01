import {get_puppeteer, get_vacancy_db, safely_wait_selector, try_linkedin_auth} from "./utils.js";

/**
 * @param cfg {JobSearchSettings}
 * @returns {Promise<void>}
 */
export default async function analyze(cfg){
    let db = await get_vacancy_db();
    let browser = await get_puppeteer();
    let q = {
        applied_ts: {$exists: false},
        percentage: {$gte: cfg.apply_threshold},
        easy_apply: true
    };
    console.debug(`Current apply_threshold=${cfg.apply_threshold}`);
    /** @type {Vacancy[]}*/
    let vacancies = await db.findAsync(q);
    if (!vacancies.length)
        return console.debug('No vacancies founded');

    console.debug('Find', vacancies.length, 'vacancies can apply to');
    /** @type {Page}*/
    let page = await browser.newPage();

    await page.goto('https://www.linkedin.com/uas/login',
        {waitUntil: 'load'});
    await try_linkedin_auth(page, cfg);
    for (let vacancy of vacancies)
    {
        let dbg = txt=>console.debug(`[${vacancy.job_id}]`, txt);

        // visit vacancy
        await page.goto(vacancy.link, {waitUntil: 'load'});
        dbg('visited vacancy');

        let btn = await page.$('button.jobs-apply-button');
        if (!btn)
        {
            dbg('Cannot find apply button');
            continue;
        }
        await btn.click();
        dbg('apply clicked');

        let form_ctrls_selector = '[id*="applyformcommon-easyApplyFormElement"]';
        if (!await safely_wait_selector(page, form_ctrls_selector, 1))
        {
            console.debug('APply form did not appeared');
        }

        let controls = await page.$$(form_ctrls_selector);


        // let selector = 'select[id=^="text-entity-list-form-component"]'
        // if (await safely_wait_selector(page, selector, 1))
        // {
        //     /** @type {ElementHandle}*/
        //     let select = await page.$(selector);
        //     select.drop()
        // }
    }
}