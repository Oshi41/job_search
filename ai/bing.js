import puppeteer from "puppeteer";
import {join_mkdir, sleep} from "oshi_utils";
import os from "os";
import {get_puppeteer, safely_wait_idle, safely_wait_selector, wait_rand} from "../utils.js";
import {EventEmitter} from 'events';

let browser, page, client, was_init;

const emitter = new EventEmitter();

const textarea_js_selector_parent = 'document.querySelector("#b_sydConvCont > cib-serp").shadowRoot.querySelector("#cib-action-bar-main").shadowRoot.querySelector("div > div.main-container > div > div.input-row > cib-text-input").shadowRoot.querySelector("#searchboxform")';
const textarea_js_selector = 'document.querySelector("#b_sydConvCont > cib-serp").shadowRoot.querySelector("#cib-action-bar-main").shadowRoot.querySelector("div > div.main-container > div > div.input-row > cib-text-input").shadowRoot.querySelector("#searchbox")';
const sumbit_btn_js_selector = 'document.querySelector("#b_sydConvCont > cib-serp").shadowRoot.querySelector("#cib-action-bar-main").shadowRoot.querySelector("div > div.main-container > div > div.bottom-controls > div.bottom-right-controls > div.control.submit > button")';

const queue = [];
let is_processing;

async function process_queue() {
    if (is_processing)
        return;

    async function process_single_item() {
        if (!queue.length)
            throw new Error('Empty queue');

        console.debug('processing AI queue');
        let {text, sec_timeout, cb} = queue[0];

        let form = await page.evaluateHandle(textarea_js_selector_parent);
        if (!form)
            throw new Error('No textbox founded');
        let textarea = await page.evaluateHandle(textarea_js_selector);
        if (!textarea)
            throw new Error('No textbox founded');

        await wait_rand(500);

        await form.$eval('#searchbox', (x, txt)=>{
            x.value = txt;
        }, text);
        await wait_rand(137);
        await textarea.focus();
        await textarea.type(' \n', {delay: 120});

        console.debug('Entered prompt, waiting for result');

        let resp = await new Promise((resolve, reject) => {
            sleep(1000 * sec_timeout).then(() => {
                console.debug('AI resp timeout');
                resolve('');
            });
            emitter.once('ai_resp', args => {
                console.debug('AI resp event');
                let bot_messages = args.item.messages.filter(x => x.author == 'bot').map(x => x.text);
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
        }
    }
    is_processing = false;
}

export async function init() {
    if (was_init === false)
        return; // already is in init function

    if (was_init === true)
        return; // already finished

    was_init = false;

    browser = await get_puppeteer();
    page = await browser.newPage();
    client = await page.target().createCDPSession();
    await client.send('Network.enable');

    client.on('Network.webSocketFrameReceived', event => {
        const {requestId, response, timestamp} = event;
        try {
            // todo debug
            let resp = JSON.parse(response.payloadData.split('\o')?.[0]);
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

    await textarea_form.$eval('#searchbox', x => {
        x.setAttribute('maxlength', '10000');
    });

    was_init = true;
}

export async function ask(text, on_resp_fn, sec_timeout = 30) {
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

ask('Say hi\nTo me\nLalalalalala').then(x=>console.log('HEREEE:', x));