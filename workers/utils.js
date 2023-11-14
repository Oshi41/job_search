import fs from 'fs';
import stealth_plugin from "puppeteer-extra-plugin-stealth";
import puppeteer from "puppeteer-extra";
import {join_mkdir, Queue, _} from "oshi_utils";
import os from "os";
import {safely_wait_idle, safely_wait_selector, update_one, user_typing, wait_rand} from "../utils.js";

puppeteer.use(stealth_plugin());

const userDataDir = join_mkdir(os.homedir(), 'job_search', 'browser_data');
let edge_browser_p, chromium_browser_p;

/*** @returns {Promise<Browser>}*/
export async function edge_browser() {
    edge_browser_p = edge_browser_p || new Promise(async (resolve, reject) => {
        try {
            let browser = await puppeteer.launch({
                executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
                headless: false,
                userDataDir,
                defaultViewport: {
                    width: 1000,
                    height: 1000,
                    hasTouch: false,
                    isMobile: false,
                },
            });
            resolve(browser);
        } catch (e) {
            reject(e);
        }
    });
    return await edge_browser_p;
}

/*** @returns {Promise<Browser>}*/
export async function chromium_browser() {
    chromium_browser_p = chromium_browser_p || new Promise(async (resolve, reject) => {
        try {
            let browser = await puppeteer.launch({
                product: 'chrome',
                headless: false,
                userDataDir,
                defaultViewport: {
                    width: 1000,
                    height: 1000,
                    hasTouch: false,
                    isMobile: false,
                },
            });
            resolve(browser);
        } catch (e) {
            reject(e);
        }
    });
    return await chromium_browser_p;
}

/**
 * @param page {Page}
 * @param login {string}
 * @param pass {string}
 * @returns {Promise<boolean | undefined>}
 */
export async function linkedin_auth(page, {login, pass}) {
    console.debug('[linkedin] trying to auth');

    let selector = 'input#username';
    if (await safely_wait_selector(page, selector, 0.5)) {
        console.debug('entering login');
        let ctrl = await page.$(selector);
        await user_typing(ctrl, login);
        await wait_rand(261);
    }

    selector = 'input#password';
    if (await safely_wait_selector(page, selector, 0.5)) {
        console.debug('entering password');
        let ctrl = await page.$(selector);
        await user_typing(ctrl, pass);
        await wait_rand(261);
    }

    selector = 'button.btn__primary--large';
    if (await safely_wait_selector(page, selector, 0.5)) {
        console.debug('login click');
        let ctrl = await page.$(selector);
        await ctrl.click({button: 'left'});
        await safely_wait_idle(page, 10);
        return true;
    }
}

export class Worker {
    /**
     * Worker based on tasks
     * @param db - jobs database
     * @param process_single_item - single job handler
     * @param key_fn - mongo ID from document function
     */
    constructor(db, process_single_item, key_fn) {
        const _this = this;
        this.db = db;
        this.key_fn = key_fn;
        this.queue = new Queue(async function _process_single_item(item) {
            console.debug('starting processing item', item._id);
            await update_one(db, _this.key_fn(item), {start: new Date()});
            let append_to_job = {};
            this.append2job = x => _.assign(append_to_job, x);
            const on_finish = error => {
                let upd = {end: new Date()};
                if (error)
                {
                    console.debug('Error during item processing', item, error);
                    upd.error = error;
                } else {
                    console.debug('finishing processing item', item._id);
                }
                if (typeof append_to_job == 'object')
                    _.assign(upd, append_to_job);
                return update_one(_this.db, _this.key_fn(item), upd);
            };

            this.then(on_finish);
            this.catch(on_finish);
            await process_single_item.bind(this)(item);
        })
    }

    async #queue(tasks) {
        tasks = tasks?.filter(x => !this.queue.queue.includes(x));

        if (!tasks?.length)
            return;
        console.debug('queuing', tasks.length, 'new tasks');
        this.queue.push(...tasks);

        for (let x of tasks)
            await update_one(this.db, this.key_fn(x), {scheduled: new Date()});
    }

    /**
     * @param q {Job}
     */
    run(q) {
        const _this = this;
        console.debug('start worker');

        // install tasks
        _this.db.find({end: {$exists: false}, ...q,})
            .then(tasks => _this.#queue(tasks));

        fs.watchFile(_this.db.filename, {interval: 200}, async () => {
            let tasks = await _this.db.find({
                scheduled: {$exists: false},
                start: {$exists: false},
                end: {$exists: false},
                ...q,
            });
            await _this.#queue(tasks);
        });
    }
}

/**
 * Automatically reauth Linkedin if needed
 * @param page {Page}
 * @param settings {{linkedin_auth: boolean}}
 * @returns {Promise<void>}
 */
export function use_reauth(page, settings, {login, pass}) {
    let orig_goto = page.goto.bind(page);
    page.on('response', async resp => {
        let url = resp?.url?.();
        if (url?.includes?.('api/metadata/user')) {
            try {
                let {client: {isUserLoggedIn}} = await resp.json();
                settings.linkedin_auth = !!isUserLoggedIn;
            } catch (e) {
                // ignored
            }
        }
    });
    page.goto = async function (url, arg) {
        await orig_goto(url, arg);

        if (!settings.linkedin_auth) {
            console.debug('[linkedin] trying to auth');

            await orig_goto('https://www.linkedin.com/uas/login', {waitUntil: 'load'});

            let selector = 'input#username';
            if (await safely_wait_selector(page, selector, 0.5)) {
                console.debug('entering login');
                let ctrl = await page.$(selector);
                await user_typing(ctrl, login);
                await wait_rand(261);
            }

            selector = 'input#password';
            if (await safely_wait_selector(page, selector, 0.5)) {
                console.debug('entering password');
                let ctrl = await page.$(selector);
                await user_typing(ctrl, pass);
                await wait_rand(261);
            }

            selector = 'button.btn__primary--large';
            if (await safely_wait_selector(page, selector, 0.5)) {
                console.debug('login click');
                let ctrl = await page.$(selector);
                await ctrl.click({button: 'left'});
                await safely_wait_idle(page, 10);
                return true;
            }
        }
    };
}

/**
 * Handle job info from linkedin API
 * @param page {Page}
 * @param cb {(Vacancy)=>void}
 */
export function use_job_info_cb(page, cb) {
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
            let {name: company_name, url: company_link} = job_info?.included
                ?.find(x => x.$type == 'com.linkedin.voyager.organization.Company') || {};
            let easy_apply = !!job_info?.data?.applyMethod?.easyApplyUrl;

            if (Number.isInteger(job_id)) {
                /*** @type {Vacancy}*/
                let vacancy = {
                    job_id: +job_id,
                    link: 'https://www.linkedin.com/jobs/view/' + job_id,
                    employ_status,
                    vacancy_time,
                    applies,
                    location,
                    is_closed: job_id?.data?.jobState == 'CLOSED',
                    easy_apply,
                    company_name,
                    company_link,
                    raw_job_info: JSON.stringify(job_info),
                    last_refresh: new Date(),
                };
                cb(vacancy);
            }
        }
    });
}