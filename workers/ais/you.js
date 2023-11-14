import {Awaiter, join_mkfile, Settings} from "oshi_utils";
import {edge_browser} from "../utils.js";
import {safely_wait_selector, wait_rand} from "../../utils.js";
import os from "os";

/** @type {Page}*/
let page;
const settings = new Settings(join_mkfile(os.homedir(), 'job_search', 'ai_worker.json')).use_fresh(200);
const auth_awaiter = new Awaiter(), resp_awaiter = new Awaiter();

async function wait_for_auth(page, timeout) {
    let handled = false;
    setTimeout(() => {
        if (!handled)
            throw new Error('auth_timeout');
    }, timeout);

    while (true) {
        if (await auth_awaiter.wait_for()) {
            handled = true;
            return true;
        }
    }
}

export async function ask(question) {
    console.debug('[you] asking you.com');

    let selector, ai_tokens = [];

    if (!page) {
        let browser = await edge_browser();
        page = await browser.newPage();
        let client = await page.target().createCDPSession();
        await client.send('Network.enable');

        client.on('Network.eventSourceMessageReceived', async e => {
            let {data, eventName: name} = e;

            switch (name) {
                case 'done':
                    console.debug('got DONE msg');
                    let resp = await page.evaluate(() => {
                        let history = document.querySelector('#chatHistory');
                        let last_ai_resp = history.children.item(history.children.length - 1);
                        let ad = last_ai_resp.querySelector('[data-testid="youchat-ads"]');
                        if (ad)
                            ad.parentNode.removeChild(ad);

                        let parent = last_ai_resp
                            .children.item(0)
                            .children.item(1);

                        // rm all <span /> and <a/> tags
                        parent.querySelectorAll('span').forEach(x => x.parentNode.removeChild(x));
                        parent.querySelectorAll('a').forEach(x => x.parentNode.removeChild(x));
                        return parent.outerHTML;
                    });
                    resp_awaiter.resolve(resp);
                    break;
            }
        });

        page.on('response', async resp => {
            let url = resp?.url?.();
            if (url?.includes?.('sessions/authenticate')) {
                try {
                    let json_resp = await resp.json();
                    settings.you_auth = !!json_resp?.data?.user;
                    auth_awaiter.resolve(settings.you_auth);
                } catch (e) {
                    // ignored
                }
            }
        });

        await page.goto('https://you.com/', {waitUntil: 'load'});

        selector = '.modal-close';
        if (await safely_wait_selector(page, selector, 2)) {
            console.debug('[you] closing modal')
            let btn = await page.$(selector);
            await btn.close();
        }

        if (!settings.you_auth) {
            await page.evaluate('alert("You need to authenticate by yourself within 120s")');
            await wait_for_auth(page, 120_000);
        }

        selector = '#search-input-textarea';
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

        console.debug('[you] entered prompt, waiting for response');

        // waiting 30s for response (usually faster)
        let raw_resp = await resp_awaiter.wait_for(30_000);
        if (!raw_resp)
            throw new Error('empty_response');

        return raw_resp;
    }
}