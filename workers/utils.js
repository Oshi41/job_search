import stealth_plugin from "puppeteer-extra-plugin-stealth";
import puppeteer from "puppeteer-extra";
import {join_mkdir} from "oshi_utils";
import os from "os";
import {safely_wait_idle, safely_wait_selector, user_typing, wait_rand} from "../utils.js";

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
                    width: 2000,
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
                    width: 2000,
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
    if (await safely_wait_selector(page, selector, 0.5))
    {
        console.debug('entering login');
        let ctrl = await page.$(selector);
        await user_typing(ctrl, login);
        await wait_rand(261);
    }

    selector = 'input#password';
    if (await safely_wait_selector(page, selector, 0.5))
    {
        console.debug('entering password');
        let ctrl = await page.$(selector);
        await user_typing(ctrl, pass);
        await wait_rand(261);
    }

    selector = 'button.btn__primary--large';
    if (await safely_wait_selector(page, selector, 0.5))
    {
        console.debug('login click');
        let ctrl = await page.$(selector);
        await ctrl.click({button: 'left'});
        await safely_wait_idle(page, 10);
        return true;
    }
}