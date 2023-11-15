import {chromium_browser, edge_browser} from "../utils.js";
import {safely_wait_selector, wait_rand} from "../../utils.js";
import {Awaiter, join_mkfile, Settings} from "oshi_utils";
import os from "os";

/** @type {Page}*/
let page;
const settings = new Settings(join_mkfile(os.homedir(), 'job_search', 'ai_worker.json')).use_fresh(200);

function use_reauth(page) {
    const awaiter = new Awaiter();
    let authorized = false, is_manual_auth = false;
    let _goto = page.goto.bind(page);

    page.on('response', async resp => {
        let url = resp?.url?.();
        if (url?.includes?.('session')) {
            try {
                let {user} = await resp.json();
                awaiter.resolve(authorized = !!user?.id);
            } catch (e) {
                // ignored
            }
        }
    });

    page.goto = async function (url, arg) {
        let res = await _goto(url, arg);

        // need to auth by yourself
        if (!authorized && !is_manual_auth) {
            page.evaluate('alert("You have 120s to authorize by yourself")');
            let auth_awaiter = new Awaiter();

            // need to be awaited ib background
            (async () => {
                while (!authorized)
                    await awaiter.wait_for();

                // finished manual auth
                is_manual_auth = false;
                auth_awaiter.resolve(await page.goto(url, arg));
            })();

            return await auth_awaiter.wait_for(120_000);
        }

        return res;
    };
}

export async function ask(question) {
    console.debug('[gpt] asking chat GPT');
    const resp_awaiter = new Awaiter();
    let selector;

    if (!page) {
        let browser = await chromium_browser();
        page = await browser.newPage();
        use_reauth(page);
        let client = await page.target().createCDPSession();
        await client.send('Network.enable');

        page.on('response', async resp => {
            let url = resp?.url?.();
            if (url?.includes?.('backend-api/lat/r')) {
                console.debug('[gpt] Response was received');
                // request has ended
                let text = await page.evaluate(() => {
                    let elem = Array.from(document.querySelectorAll('.agent-turn').values()).pop();
                    let text_only = elem.querySelector('.max-w-full')
                    return text_only.outerHTML;
                });
                resp_awaiter.resolve(text);
            }

            if (url?.includes?.('backend-api/conversation/')) {
                if (url.endsWith(settings.gpt_chat) && resp.status() >= 400) {
                    settings.gpt_chat = null;
                    console.debug(`[gpt] Clear obsolete GPT chat`);
                }
            }
        });

        await page.goto('https://chat.openai.com', {waitUntil: 'load'});
    }

    selector = '[role="dialog"]';
    // close popup
    if (await safely_wait_selector(page, selector, 2)) {
        let elem = await page.$(selector);
        let button = await elem.$('.btn.relative.btn-primary');
        await button?.click();
    }

    if (settings.gpt_chat) {
        await page.goto('https://chat.openai.com/c/' + settings.gpt_chat, {waitUntil: 'networkidle2'});
    } else {
        selector = '.btn.relative.btn-primary';
        let button = await page.$(selector);
        if (!button)
            throw new Error('Cannot create new chat');
        await button.click();
    }

    selector = '#prompt-textarea';
    let textarea = await page.$(selector);
    if (!textarea)
        throw new Error('Cannot enter prompt');

    // entering text instantly
    await page.$eval(selector, (x, txt) => {
        x.setAttribute('maxlength', '100000');
        x.value = txt;
    }, question);

    // making last enter with focus
    await wait_rand(137);
    await textarea.focus();
    await textarea.type(' \n', {delay: 120});

    console.debug('[gpt] entered prompt, waiting for response');

    let res = await resp_awaiter.wait_for(30_000);
    if (!res)
        throw new Error('empty response');

    if (!settings.gpt_chat) {
        let url = page.url();
        let id = url.split('/').pop();
        settings.gpt_chat = id;
    }

    return res;
}