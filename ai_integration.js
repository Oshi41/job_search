import {BingChat} from 'bing-chat';
import puppeteer from "puppeteer";
import {confirm, join_mkdir, join_mkfile, qw} from "oshi_utils";
import os from "os";
import fs from "fs";
import {click_with_mouse, safely_wait_idle, safely_wait_selector, wait_rand} from "./utils.js";

const filepath = join_mkfile(os.homedir(), 'job_search', 'browser_data', '_u.cookie');

/**
 *
 * @param type {'env' | 'file' | 'browser'}
 * @returns {Promise<*|string>}
 */
async function get_cookie(type) {
    if (type == 'env' && process.env.BING_COOKIE)
        return process.env.BING_COOKIE;

    if (type == 'file' && fs.existsSync(filepath))
        return fs.readFileSync(filepath, 'utf-8');

    if (type == 'browser') {
        let browser = await puppeteer.launch({
            executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
            headless: false,
            userDataDir: join_mkdir(os.homedir(), 'job_search', 'browser_data'),
            defaultViewport: {
                width: 3000,
                height: 1000,
                hasTouch: false,
                isMobile: false,
            },
        });
        const page = await browser.newPage();
        const client = await page.target().createCDPSession();
        await page.goto('edge://settings/searchFilters', {waitUntil: 'load'});
        let toggle = await page.$('input[type="checkbox"][checked]');
        await toggle?.click();

        await page.goto('edge://settings/privacy', {waitUntil: 'load'});
        toggle = await page.$('input[type="checkbox"][tabindex="0"][checked]');
        await toggle?.click();

        await wait_rand(246);

        while (true) {
            await page.goto('https://www.bing.com/', {waitUntil: 'networkidle2'});
            let link = await page.$('a.customIcon');
            await link?.click();

            // we still cannot use chat yet
            if (await safely_wait_selector(page, '#codexPrimaryButtonCloseModal', 2))
            {
                let btn = await page.$('#codexPrimaryButtonCloseModal');
                await btn.click();
            } else {
                break;
            }
        }

        let {cookies} = await client.send('Storage.getCookies', {});
        let c = cookies.find(x => x.name == '_U' && x.domain.includes('bing'));
        if (!c)
            throw new Error('Cannot get cookies');
        let cc = qw`KievRPSSecAuth _U`.map(x=>cookies.find(c=>c.name == x))
            .map(x=>`${x.name}=${x.value}`);
        return cc.join(';');
    }
}

export async function init_ai() {
    for (let type of qw`env file browser`) {
        let cookie = await get_cookie(type);
        try {
            let ai = new BingChat({
                cookie,
                debug: true,
            });
            process.env.BING_COOKIE = cookie;
            fs.writeFileSync(filepath, cookie, 'utf-8');
            return ai;
        } catch (e) {
            // ignored
        }
        switch (type) {
            case 'env':
                delete process.env.BING_COOKIE;
                break;
            case 'file':
                if (fs.existsSync(filepath))
                    fs.rmSync(filepath);
        }
    }
    throw new Error('Cannot init AI');
}


/**
 * @param prompts {string[]}
 * @returns {Promise<string>}
 */
export async function ask(prompts) {
    const ai = await init_ai();
    let large_prompt = prompts.join('\n\n');
    let txt = '';
    let resp = await ai.sendMessage(large_prompt, {
        variant: 'Creative',
        onProgress: partialResponse => {
            txt += partialResponse.text;
        }
    });
    console.log(resp.text, txt);
}

ask(['How are you, bing?']);