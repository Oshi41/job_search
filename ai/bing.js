import puppeteer from "puppeteer";
import {join_mkdir, sleep} from "oshi_utils";
import os from "os";
import {get_puppeteer, safely_wait_idle, safely_wait_selector, wait_rand} from "../utils.js";
import {EventEmitter} from 'events';

let browser, page, client, init_promise;

const emitter = new EventEmitter();

const textarea_js_selector_parent = 'document.querySelector("#b_sydConvCont > cib-serp").shadowRoot.querySelector("#cib-action-bar-main").shadowRoot.querySelector("div > div.main-container > div > div.input-row > cib-text-input").shadowRoot.querySelector("#searchboxform")';
const textarea_js_selector = 'document.querySelector("#b_sydConvCont > cib-serp").shadowRoot.querySelector("#cib-action-bar-main").shadowRoot.querySelector("div > div.main-container > div > div.input-row > cib-text-input").shadowRoot.querySelector("#searchbox")';
const stop_gen_button = 'document.querySelector("#b_sydConvCont > cib-serp").shadowRoot.querySelector("#cib-action-bar-main").shadowRoot.querySelector("div > cib-typing-indicator").shadowRoot.querySelector("#stop-responding-button")';
const precise_btn_js_selector = 'document.querySelector("#b_sydConvCont > cib-serp").shadowRoot.querySelector("#cib-conversation-main").shadowRoot.querySelector("#cib-chat-main > cib-welcome-container").shadowRoot.querySelector("div.controls > cib-tone-selector").shadowRoot.querySelector("#tone-options > li:nth-child(3) > button")';

const queue = [];
let is_processing, prompt_count = 0;

async function process_queue() {
    if (is_processing)
        return;

    async function process_single_item() {
        if (!queue.length)
            throw new Error('Empty queue');

        if (prompt_count > 25)
        {
            console.debug('refresh page due to prompt request overload');
            await page.reload({waitUntil: 'load'});
            prompt_count = 0;
        }

        console.debug('processing AI queue');
        let {text, sec_timeout, cb} = queue[0];

        let precise_btn = await page.evaluateHandle(precise_btn_js_selector);
        await precise_btn?.click();

        let stop_btn = await page.evaluateHandle(stop_gen_button);
        await stop_btn?.click?.(); // stop prev answers

        let form = await page.evaluateHandle(textarea_js_selector_parent);
        if (!form)
            throw new Error('No textbox founded');
        let textarea = await page.evaluateHandle(textarea_js_selector);
        if (!textarea)
            throw new Error('No textbox founded');

        await wait_rand(500);

        await form.$eval('#searchbox', (x, txt)=>{
            x.setAttribute('maxlength', '100000');
            x.value = txt;
        }, text);

        await wait_rand(137);
        await textarea.focus();
        await textarea.type(' \n', {delay: 120});

        prompt_count++;
        console.debug(`[${prompt_count}] Entered prompt, waiting for result`);


        let resp = await new Promise((resolve, reject) => {
            if (sec_timeout > 0)
            {
                sleep(1000 * sec_timeout).then(() => {
                    console.debug('AI resp timeout');
                    resolve('');
                });
            }
            emitter.once('ai_resp', args => {
                console.debug('AI resp event');
                let bot_messages = args.item.messages.filter(x => x.author == 'bot' && !x.messageType).map(x => x.text);
                resolve(bot_messages.join('\n'));
            });
        });
        console.debug('Got AI response');
        await cb?.(resp);
    }

    is_processing = true;
    while (queue.length) {
        try {
            await process_single_item();
            queue.shift();
        } catch (e) {
            console.warn('Error during queue processing:', e);
            await wait_rand(435);
        }
    }
    is_processing = false;
}

export async function init() {
    init_promise = init_promise || new Promise(async resolve => {
        browser = await get_puppeteer();
        page = await browser.newPage();
        client = await page.target().createCDPSession();
        await client.send('Network.enable');

        client.on('Network.webSocketFrameReceived', event => {
            const {requestId, response, timestamp} = event;
            try {
                let first_json = response.payloadData.split('')[0]
                let resp = JSON.parse(first_json);
                if (resp?.type == 2 && `conversationId requestId`.split(' ').every(x => !!resp.item?.[x]))
                    emitter.emit('ai_resp', resp);
            } catch (e) {
                // ignored
            }
        });

        // disable search filter
        await page.goto('edge://settings/searchFilters', {waitUntil: 'load'});
        let toggle = await page.$('input[type="checkbox"][checked]');
        await toggle?.click();

        // disable trace defence
        await page.goto('edge://settings/privacy', {waitUntil: 'load'});
        toggle = await page.$('input[type="checkbox"][tabindex="0"][checked]');
        await toggle?.click();

        while (true) {
            // checking if we allowed to use chat
            await page.goto('https://www.bing.com/', {waitUntil: 'networkidle2'});
            // navigate on 'chat'
            let link = await page.$('a.customIcon');
            await link?.click();

            // annoying splash screen about safe search settings
            if (!await safely_wait_selector(page, '#codexPrimaryButtonCloseModal', 2))
                break;

            let btn = await page.$('#codexPrimaryButtonCloseModal');
            await btn.click();
        }

        await safely_wait_idle(page, 2);

        let textarea_form = await page.evaluateHandle(textarea_js_selector_parent);
        if (!textarea_form)
            throw new Error('Cannot find form');


        resolve(true);
    });
    return await init_promise;
}

export async function ask(text, on_resp_fn, sec_timeout = -1) {
    await init();
    let promise = new Promise((resolve, reject) => {
        queue.push({
            text, sec_timeout, cb: resp => {
                resolve(resp);
            }
        });
    });
    process_queue();
    return await promise;
}