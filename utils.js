import {join_mkdir, join_mkfile, sleep} from "oshi_utils";
import puppeteer from "puppeteer";
import os from "os";
import {default as nedb} from '@seald-io/nedb';

/**
 * @param elem {ElementHandle}
 * @param text {string}
 * @param base_delay {number} typing delay
 */
export async function user_typing(elem, text, base_delay = 174) {
    for (let i = 0; i < text.length; i++) {
        let char = text.at(i);
        elem.type(char);
        await wait_rand(base_delay);
    }
}

export async function wait_rand(base) {
    await sleep(Math.random() * 100 + base);
}

/**
 * @param elem {ElementHandle}
 * @param regex {RegExp}
 * @returns {Promise<string>}
 */
export async function find_prop(elem, regex) {
    let map = await elem.getProperties();
    let key = map.keys_arr().find(x => regex.test(x));
    let prop = map.get(key);
    return prop?.toString();
}

/**
 * @param page {Page}
 * @param sec {number}
 * @returns {Promise<void>}
 */
export async function safely_wait_idle(page, sec) {
    try {
        await page.waitForNetworkIdle({timeout: 1000 * sec});
        return true;
    } catch (e) {
        // ignored
    }
    return false;
}

/**
 * @param page {Page}
 * @param selector {string}
 * @param sec {number}
 * @returns {Promise<boolean>}
 */
export async function safely_wait_selector(page, selector, sec) {
    try {
        await page.waitForSelector(selector, {timeout: 1000 * sec, visible: true});
        return true;
    } catch (e) {
        // ignored
        return false;
    }
}

/**
 * @param page {Page}
 * @param elem {ElementHandle}
 * @returns {Promise<void>}
 */
export async function click_with_mouse(page, elem) {
    /** @type {BoundingBox} */
    let box = await elem.boundingBox();
    if (!box)
        await elem.scrollIntoView();
    box = await elem.boundingBox();
    if (!box)
        throw new Error('unk elem');

    let x_f = box.x + box.width / 2;
    let y_f = box.y + box.height / 2;

    await page.mouse.move(x_f, y_f, {steps: 10});
    await page.mouse.click(x_f, y_f, {count: 2});
}

let browser_promise;

/** @returns {Promise<Browser>}*/
export async function get_puppeteer() {
    if (!browser_promise) {
        browser_promise = new Promise(async resolve => {
            resolve(await puppeteer.launch({
                executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
                headless: false,
                userDataDir: join_mkdir(os.homedir(), 'job_search', 'browser_data'),
                defaultViewport: {
                    width: 2000,
                    height: 1000,
                    hasTouch: false,
                    isMobile: false,
                },
            }));
        })
    }
    return await browser_promise;
};

let vacancy_db_p, resume_db_p;

export async function get_vacancy_db() {
    vacancy_db_p = vacancy_db_p || new Promise(async resolve => {
        /*** @type {Nedb<Vacancy>}*/
        let db = new nedb({
            filename: join_mkfile(os.homedir(), 'job_search', 'vacancies.jsonl'),
        });
        console.debug('vacancy db init');
        await db.ensureIndexAsync({fieldName: 'job_id', unique: true});
        await db.loadDatabaseAsync();
        console.log('loaded vacancy database');
        resolve(db);
    });

    return await vacancy_db_p;
}

/**
 * @param page {Page}
 * @param keys {KeyInput}
 * @returns {Promise<void>}
 */
export async function press_keys(page, ...keys){
    for (let key of keys) {
        await page.keyboard.down(key);
        await wait_rand(100);
    }
    for (let key of keys.reverse()) {
        await page.keyboard.up(key);
        await wait_rand(100);
    }
}

/**
 * @param db {Nedb}
 * @param q {any}
 * @param upd {any}
 * @returns {Promise<void>}
 */
export async function update_one(db, q, upd){
    let count = await db.countAsync(q);
    let doc = Object.assign({...upd}, q);
    if (count == 0)
        return await db.insertAsync(doc);
    if (count == 1)
    {
        let source = await db.findOneAsync(q);
        console.assert(1 == await db.removeAsync(q));
        Object.assign(source, upd);
        return await db.insertAsync(source);
    }
    throw new Error('Wrong query');
}

/**
 * @typedef {object} Vacancy
 * @property {URL} link - Job link
 * @property {Date} insert_time - DB insertion time
 * @property {Date} vacancy_time - When vacancy was created
 * @property {number} job_id - Job link
 * @property {string} text - job description
 * @property {boolean} easy_apply - can easy apply from LinkedIn
 * @property {string} search_txt - Search text how we found this job
 * @property {number} percentage - How much this job is suitable for you
 * @property {string} ai_resp - Raw AI response
 */

/**
 * @typedef {object} JobSearchSettings
 * @property {string} login - LinkedIn email login
 * @property {string} pass - LinkedIn account password
 * @property {string[]} searches - List of LinkedIn job searches
 * @property {string} location - Desired LinkedIn job location
 * @property {string?} prompt - Optional AI chat prompt
 */

/**
 * @typedef {object} ResumeCache
 * @property {string} fullpath - fullpath to resume file
 * @property {string} hash - md5 hash of text it was made of
 */