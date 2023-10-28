import {join_mkdir, join_mkfile, sleep} from "oshi_utils";
import puppeteer from "puppeteer";
import os from "os";

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
    await sleep(Math.random()*100+base);
}

/**
 * @param elem {ElementHandle}
 * @param regex {RegExp}
 * @returns {Promise<string>}
 */
export async function find_prop(elem, regex){
    let map = await elem.getProperties();
    let key = map.keys_arr().find(x=>regex.test(x));
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
        await page.waitForNetworkIdle({timeout: 1000*sec});
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
        await page.waitForSelector(selector, {timeout: 1000*sec, visible: true});
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

    let x_f = box.x + box.width/2;
    let y_f = box.y + box.height/2;

    await page.mouse.move(x_f, y_f, {steps: 10});
    await page.mouse.click(x_f, y_f, {count: 2});
}

let browser;
export async function get_puppeteer(){
    if (!browser)
    {
        browser = await puppeteer.launch({
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
    }
    return browser;
};

export const vacancies_json_path = join_mkfile(os.homedir(), 'job_search', 'vacancies.json');