import {Awaiter, join_mkfile, Settings} from "oshi_utils";
import {edge_browser} from "../utils.js";
import {safely_wait_selector, wait_rand} from "../../utils.js";
import os from "os";

/** @type {Page}*/
let page;
const resp_awaiter = new Awaiter();

function use_reauth(page) {
    const awaiter = new Awaiter();
    let authorized = false, is_manual_auth = false;

    page.on('response', async resp => {
        let url = resp.url();
        if (url?.includes?.('/authenticate')) {
            try {
                let json_resp = await resp.json();
                authorized = !!json_resp?.data?.user;
                awaiter.resolve(authorized);
            } catch (e) {
                // ignored
            }
        }
    });

    let _goto = page.goto.bind(page);
    page.goto = async function (url, arg) {
        let res = await _goto(url, arg);

        if (!is_manual_auth && !authorized) {
            is_manual_auth = true;
            page.evaluate('alert("You have 120s to authorize by yourself")');
            let _awaiter = new Awaiter();

            // need to be awaited ib background
            (async () => {
                while (!authorized)
                    await awaiter.wait_for();

                // finished manual auth
                is_manual_auth = false;
                _awaiter.resolve(await page.goto(url, arg));
            })();

            return await _awaiter.wait_for(120_000);
        }

        return res;
    }
}

export async function ask(question) {
    console.debug('[you] asking you.com');

    let selector, ai_tokens = [];

    if (!page) {
        let browser = await edge_browser();
        page = await browser.newPage();
        use_reauth(page);
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

        await page.goto('https://you.com/', {waitUntil: 'networkidle0'});

        selector = '.modal-close';
        if (await safely_wait_selector(page, selector, 2)) {
            console.debug('[you] closing modal')
            let btn = await page.$(selector);
            await btn.close();
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

