import fs from 'fs';
import os from "os";
import puppeteer from "puppeteer";
import {read_json} from 'oshi_utils';
import {get_puppeteer, safely_wait_idle, user_typing, wait_rand, vacancies_json_path} from "./utils.js";

/**
 * @typedef {object} Vacancy
 * @property {URL} link - Job link
 * @property {string} text - job description
 * @property {boolean} easy_apply - can easy apply from LinkedIn
 * @property {string} search_txt - Search text how we found this job
 * @property {number} percentage - How much this job is suitable for you
 * @property {string} ai_resp - Raw AI response
 */

/**
 *
 * @param page {Page}
 * @param login {string}
 * @param pass {string}
 * @returns {Promise<void>}
 */
async function try_auth(page, {login, pass}) {
    console.debug('trying to auth');
    /*** @type {ElementHandle}*/
    let input = await page.$('input#username');
    if (input)
    {
        console.debug('entering login');
        await user_typing(input, login);
        await wait_rand(261);
    }
    input = await page.$('input#password');
    if (input)
    {
        console.debug('entering password');
        await user_typing(input, pass);
        await wait_rand(247);
    }
    /*** @type {ElementHandle}*/
    let btn = await page.$('button.btn__primary--large');
    if (btn)
    {
        console.debug('login click');
        await btn.click({button: 'left'});
    }
}

/**
 * @param page {Page}
 * @param selector {string} - content selector we want to retrive text
 * @param use_recognition {boolean}
 * @returns {Promise<string>}
 */
async function read_content(page, selector, {use_recognition = false}={}) {
    if (!use_recognition)
    {
        let res = await page.$eval(selector, elem=>{
            return Array.from(elem.childNodes.values()).map(elem=>{
                switch (elem.nodeType)
                {
                    case Node.TEXT_NODE:
                        if (elem.tagName == 'LI'){
                            return '* '+elem.textContent;
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
async function scan_page(page, max_page, meta, {on_vacancy_founded}={}) {
    let pagination_sel = '.artdeco-pagination__pages--number';
    console.debug('waiting for paginator');
    await page.waitForSelector(pagination_sel);
    let buttons_count = await page.$eval(pagination_sel, x=>Array.from(x.childNodes.values())
        .filter(n=>n.id).map(n=>({id: n.id})).length);
    let vacancies_map = new Map(read_json(vacancies_json_path, {def_val: []}).map(x=>[x.job_id, x]));

    for (let i = 0, end = Math.min(buttons_count, max_page); i < end; i++) {
        let btn = await page.$(pagination_sel+` > [data-test-pagination-page-btn="${i+1}"]`);
        if (!btn)
            break;
        await btn.click();
        console.debug('clicked', i, 'page button and wait for page loading');
        await safely_wait_idle(page, 5)

        let container = await page.$('.scaffold-layout__list-container');
        let map = await container.$$eval('li.ember-view', arr=>{
            return arr.map(x=>{
                let id = x.id, job_id;
                for (let i = 0; i < x.attributes.length; i++) {
                    let attr = x.attributes.item(i);
                    if (/job.+id/.test(attr.name))
                    {
                        job_id = attr.value;
                        break;
                    }
                }
                return {
                    selector: 'li#'+id,
                    job_id
                };
            });
        });
        console.debug('Founded', map.length, 'vacancies on', i, 'page');

        for (let {selector, job_id} of map)
        {
            let vacancy = await page.$(selector); // li
            await vacancy.scrollIntoView();
            console.debug('Scrolled to vacancy');
            await wait_rand(576);
            await vacancy.click();
            console.debug('Clicked on vacancy, waiting for page loading');

            await safely_wait_idle(page, 2);

            let link = 'https://www.linkedin.com/jobs/view/'+job_id;
            selector = '.jobs-description-content';

            let text = await read_content(page, selector);
            console.debug('Read vacancy content');
            text = text.replace(/\n\n+/g, '\n\n');
            let easy_apply = await page.$(`button[data-job-id="${job_id}"]`);
            console.debug('Checked for easy apply');
            if (vacancies_map.has(job_id))
            {
                let stored = vacancies_map.get(job_id);
                if (stored.text == text && !!stored.ai_resp)
                    continue; // we have already handled this vacancy
            }
            let v = {
                job_id,
                link: new URL(link),
                text,
                easy_apply: !!easy_apply,
                ...(meta||{}),
            };
            vacancies_map.set(job_id, v);
            function save_all() {
                console.debug('Save all', vacancies_map.size, 'founded vacancies');
                fs.writeFileSync(vacancies_json_path, JSON.stringify(
                    vacancies_map.values_arr(),
                    null,
                    2
                ), "utf-8");
            }
            save_all();
            on_vacancy_founded?.(v, changed=>{
                vacancies_map.set(changed.job_id, changed);
                save_all();
            });
        }
    }
}


/**
 * @param linkedin {{login: string, pass: string, searches: string[]}}
 * @returns {Promise<Vacancy[]>}
 */
export default async function main(linkedin, opt) {
    console.debug('read settings: success');

    let browser = await get_puppeteer();
    const page = await browser.newPage();
    let a = await page.$('' );

    const client = await page.target().createCDPSession();
    await page.goto('https://www.linkedin.com/uas/login',
        {waitUntil: 'load'});
    await try_auth(page, linkedin);
    await wait_rand(574);

    for (let search_txt of linkedin.searches) {
        let url = new URL('https://www.linkedin.com/jobs/search');
        url.searchParams.append('keywords', search_txt);
        url.searchParams.append('location', '');

        console.debug('navigate to user search');
        await page.goto(url.toString(), {waitUntil: 'load'});
        console.debug('job scanning');
        await scan_page(page, 5, {search_txt}, opt);
    }
    return read_json(vacancies_json_path);
}