import fs from 'fs';
import os from "os";
import puppeteer from "puppeteer";
import {join_mkdir, join_mkfile, read_json, sleep} from 'oshi_utils';
import {find_prop, safely_wait_idle, user_typing, wait_rand} from "./utils.js";

const vacancies_json_path = join_mkfile(os.homedir(), 'job_search', 'vacancies.json');

/**
 * @typedef {object} Vacancy
 * @property {URL} link - Job link
 * @property {string} text - job description
 * @property {boolean} easy_apply - can easy apply from LinkedIn
 * @property {string} search_txt - Search text how we found this job
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
async function scan_page(page, max_page, meta, {on_vacancy_founded}) {
    let pagination_sel = '.artdeco-pagination__pages--number';
    await page.waitForSelector(pagination_sel);
    let buttons_count = await page.$eval(pagination_sel, x=>Array.from(x.childNodes.values())
        .filter(n=>n.id).map(n=>({id: n.id})).length);
    let vacancies_map = new Map(read_json(vacancies_json_path, {def_val: []}).map(x=>[x.job_id, x]));

    for (let i = 0, end = Math.min(buttons_count, max_page); i < end; i++) {
        let btn = await page.$(pagination_sel+` > [data-test-pagination-page-btn="${i+1}"]`);
        if (!btn)
            break;
        await btn.click();
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

        for (let {selector, job_id} of map)
        {
            let vacancy = await page.$(selector); // li
            await vacancy.scrollIntoView();
            await wait_rand(576);
            await vacancy.click();

            await safely_wait_idle(page, 2);

            let link = 'https://www.linkedin.com/jobs/view/'+job_id;
            selector = '.jobs-description-content';

            let text = await read_content(page, selector);
            text = text.replace(/\n\n+/g, '\n\n');
            let easy_apply = await page.$(`button[data-job-id="${job_id}"]`);
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

    let browser = await puppeteer.launch({
        executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
        headless: false,
        userDataDir: join_mkdir(os.homedir(), 'job_search', 'browser_data'),
        defaultViewport: {
            width: 2000,
            height: 1000,
            hasTouch: false,
            isMobile: false,
        },
    });
    const page = await browser.newPage();
    const client = await page.target().createCDPSession();
    await page.goto('https://www.linkedin.com/uas/login',
        {waitUntil: 'load'});
    await try_auth(page, linkedin);
    await wait_rand(574);

    for (let search_txt of linkedin.searches) {
        let url = new URL('https://www.linkedin.com/jobs/search');
        url.searchParams.append('keywords', search_txt);
        url.searchParams.append('location', '');

        await page.goto(url.toString(), {waitUntil: 'networkidle2'});
        await scan_page(page, 5, {search_txt}, opt);
    }
    return read_json(vacancies_json_path);
}