import {Awaiter, date, join_mkfile, Settings} from "oshi_utils";
import os from "os";
import {safely_wait_idle, safely_wait_selector, wait_rand} from "../../utils.js";
import {edge_browser} from "../utils.js";

const settings = new Settings(join_mkfile(os.homedir(), 'job_search', 'ai_worker.json')).use_fresh(200);
const textarea_js_selector_parent = 'document.querySelector("#b_sydConvCont > cib-serp").shadowRoot.querySelector("#cib-action-bar-main").shadowRoot.querySelector("div > div.main-container > div > div.input-row > cib-text-input").shadowRoot.querySelector("#searchboxform")';
const textarea_js_selector = 'document.querySelector("#b_sydConvCont > cib-serp").shadowRoot.querySelector("#cib-action-bar-main").shadowRoot.querySelector("div > div.main-container > div > div.input-row > cib-text-input").shadowRoot.querySelector("#searchbox")';
const stop_gen_button = 'document.querySelector("#b_sydConvCont > cib-serp").shadowRoot.querySelector("#cib-action-bar-main").shadowRoot.querySelector("div > cib-typing-indicator").shadowRoot.querySelector("#stop-responding-button")';
const precise_btn_js_selector = 'document.querySelector("#b_sydConvCont > cib-serp").shadowRoot.querySelector("#cib-conversation-main").shadowRoot.querySelector("#cib-chat-main > cib-welcome-container").shadowRoot.querySelector("div.controls > cib-tone-selector").shadowRoot.querySelector("#tone-options > li:nth-child(3) > button")';
const awaiter = new Awaiter();

/** @type {Page}*/
let page;

export async function ask(question) {
    if (settings.bing_throttle && settings.bing_throttle < new Date())
        throw new Error('throttled');

    console.debug('trying to ask bing');

    if (!page)
    {
        let browser = await edge_browser();
        page = await browser.newPage();
        let client = await page.target().createCDPSession();
        await client.send('Network.enable');

        const on_web_socket = event => {
            const {requestId, response, timestamp} = event;
            try {
                let first_json = response.payloadData.split('')[0]
                let resp = JSON.parse(first_json);
                if (resp?.type == 2 && `conversationId requestId`.split(' ').every(x => !!resp.item?.[x]))
                    awaiter.resolve(resp);
            } catch (e) {
                // ignored
            }
        };

        // listen websocket messages
        client.on('Network.webSocketFrameReceived', on_web_socket);

        console.debug('[bing init] disabling search filter');
        // disable search filter
        await page.goto('edge://settings/searchFilters', {waitUntil: 'load'});
        let toggle = await page.$('input[type="checkbox"][checked]');
        await toggle?.click();

        console.debug('[bing init] disabling trace defence');
        // disable trace defence
        await page.goto('edge://settings/privacy', {waitUntil: 'load'});
        toggle = await page.$('input[type="checkbox"][tabindex="0"][checked]');
        await toggle?.click();

        while (true) {
            console.debug('[bing init] visiting bing');
            // checking if we allowed to use chat
            await page.goto('https://www.bing.com/', {waitUntil: 'load'});
            // navigate on 'chat'
            let link = await page.$('a.customIcon');
            await link?.click();
            console.debug(`[bing init] navigate on 'chat'`);

            // annoying splash screen about safe search settings
            if (!await safely_wait_selector(page, '#codexPrimaryButtonCloseModal', 2)) {
                console.debug('[bing init] can ask bing');
                break;
            }

            let btn = await page.$('#codexPrimaryButtonCloseModal');
            await btn.click();
            console.debug('[bing init] closing splash screen');
        }

        await safely_wait_idle(page, 2);

        // checking if we can write messages
        let textarea_form = await page.evaluateHandle(textarea_js_selector_parent);
        if (!textarea_form)
            throw new Error('Cannot find form');
        console.debug('[bing init finished] can chat with AI');
    }

    // precise AI mode
    let precise_btn = await page.evaluateHandle(precise_btn_js_selector);
    await precise_btn?.click();
    console.debug('[bing_ai] set precise AI chat mode');

    // stop prev answer generation
    let stop_btn = await page.evaluateHandle(stop_gen_button);
    if (stop_btn) {
        await stop_btn.click?.();
        console.debug('[bing_ai] stopped generation prev answer');
    }

    // form for entering text
    let form = await page.evaluateHandle(textarea_js_selector_parent);
    if (!form)
        throw new Error('Can not enter text');
    let textarea = await page.evaluateHandle(textarea_js_selector);
    if (!textarea)
        throw new Error('Can not enter text');

    await wait_rand(500);

    // entering text instantly
    await form.$eval('#searchbox', (x, txt) => {
        x.setAttribute('maxlength', '100000');
        x.value = txt;
    }, question);

    // making last enter with focus
    await wait_rand(137);
    await textarea.focus();
    await textarea.type(' \n', {delay: 120});

    console.debug('[bing_ai] entered prompt, waiting for response');

    // waiting 30s for response (usually faster)
    let raw_resp = await awaiter.wait_for(30_000);

    // spesial answer - bing throttle
    if (raw_resp.item.result.value == 'Throttled')
    {
        settings.bing_throttle = date.add(new Date(), {d: 1});
        return ask(question);
    }

    let bot_messages = raw_resp.item?.messages?.filter(x => x.author == 'bot' && !x.messageType).map(x => x.text);
    if (!bot_messages)
        throw new Error('Empty AI response');
    return  bot_messages.join('\n');
}