import {get_jobs_db, get_vacancy_db, safely_wait_idle, safely_wait_selector, update_one, wait_rand} from "../utils.js";
import {Awaiter, date, join_mkfile, Queue, Settings, sleep} from "oshi_utils";
import {chromium_browser, edge_browser} from "./utils.js";
import fs from "fs";
import path from "path";
import {build_resume} from "../resume_bulider.js";
import {read_settings} from "../backend/utils.js";
import os from "os";

const textarea_js_selector_parent = 'document.querySelector("#b_sydConvCont > cib-serp").shadowRoot.querySelector("#cib-action-bar-main").shadowRoot.querySelector("div > div.main-container > div > div.input-row > cib-text-input").shadowRoot.querySelector("#searchboxform")';
const textarea_js_selector = 'document.querySelector("#b_sydConvCont > cib-serp").shadowRoot.querySelector("#cib-action-bar-main").shadowRoot.querySelector("div > div.main-container > div > div.input-row > cib-text-input").shadowRoot.querySelector("#searchbox")';
const stop_gen_button = 'document.querySelector("#b_sydConvCont > cib-serp").shadowRoot.querySelector("#cib-action-bar-main").shadowRoot.querySelector("div > cib-typing-indicator").shadowRoot.querySelector("#stop-responding-button")';
const precise_btn_js_selector = 'document.querySelector("#b_sydConvCont > cib-serp").shadowRoot.querySelector("#cib-conversation-main").shadowRoot.querySelector("#cib-chat-main > cib-welcome-container").shadowRoot.querySelector("div.controls > cib-tone-selector").shadowRoot.querySelector("#tone-options > li:nth-child(3) > button")';

const settings = new Settings(join_mkfile(os.homedir(), 'job_search', 'ai_worker.json')).use_fresh(200);
const queue = new Queue(run_single_task);
let init_bing = false;


/**
 * @param job {Job}
 * @returns {Promise<void>}
 */
async function run_single_task(job) {
    console.debug(`Running task ${job._id}`);
    let vacancy_db = await get_vacancy_db();
    let q = {job_id: +job.job_id}, vacancy = await vacancy_db.findOneAsync(q);
    if (!vacancy)
        throw new Error('Cannot find such JobID in database');

    // todo where is the pass?
    let cfg = await read_settings();
    let dbg = (...args) => console.debug(`[${job._id}]`, ...args);
    dbg('read settings');

    let prompt = 'Your role is HR helper. You will need to read resume and vacancy text below and ' +
        'find out how this job is suitable for both job seeker and recruiter. Your response must contain ' +
        'compatibility percentage (0-100%), newline, provide desired vacancy stack I have (list with bullets), ' +
        'newline, vacancy stack I do not have (list with bullets), newline, salary is mentioned, newline, ' +
        'can job provide work/visa/relocation if mentioned, newline, job location if mentioned, newline, ' +
        'company name and what is it doing (very shortly), newline, what should I do at this role (shortly). '
        + cfg?.prompt;
    let resume_txt = fs.readFileSync(path.resolve(await build_resume(), '..', 'resume.txt'), 'utf-8');
    let all_prompt = [prompt, vacancy.text, resume_txt].join('\n\n');
    let ai_resp, ai;

    dbg('constructed prompt');

    // bing can add throttle period
    if (!ai_resp && !settings.bing_throttle || settings.bing_throttle < new Date()) {
        ai = 'bing';
        dbg('trying bing chat');
        let awaiter = new Awaiter(), browser = await edge_browser(), page = await browser.newPage();
        this.finally(page.close);
        if (!init_bing) {
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


            dbg('disabling search filter');
            // disable search filter
            await page.goto('edge://settings/searchFilters', {waitUntil: 'load'});
            let toggle = await page.$('input[type="checkbox"][checked]');
            await toggle?.click();

            dbg('disabling trace defence');
            // disable trace defence
            await page.goto('edge://settings/privacy', {waitUntil: 'load'});
            toggle = await page.$('input[type="checkbox"][tabindex="0"][checked]');
            await toggle?.click();

            while (true) {
                dbg('visiting bing');
                // checking if we allowed to use chat
                await page.goto('https://www.bing.com/', {waitUntil: 'networkidle2'});
                // navigate on 'chat'
                let link = await page.$('a.customIcon');
                await link?.click();
                dbg(`navigate on 'chat'`);

                // annoying splash screen about safe search settings
                if (!await safely_wait_selector(page, '#codexPrimaryButtonCloseModal', 2)) {
                    dbg('can ask bing');
                    break;
                }

                let btn = await page.$('#codexPrimaryButtonCloseModal');
                await btn.click();
                dbg('closing splash screen');
            }

            await safely_wait_idle(page, 2);

            // checking if we can write messages
            let textarea_form = await page.evaluateHandle(textarea_js_selector_parent);
            if (!textarea_form)
                throw new Error('Cannot find form');
            dbg('can chat with AI');
            init_bing = true;
        }

        // precise AI mode
        let precise_btn = await page.evaluateHandle(precise_btn_js_selector);
        await precise_btn?.click();
        dbg('set precise AI chat mode');

        // stop prev answer generation
        let stop_btn = await page.evaluateHandle(stop_gen_button);
        if (stop_btn) {
            await stop_btn.click?.();
            dbg('stopped generation prev answer');
        }

        // form for entering text
        let form = await page.evaluateHandle(textarea_js_selector_parent);
        if (!form)
            throw new Error('No textbook founded');
        let textarea = await page.evaluateHandle(textarea_js_selector);
        if (!textarea)
            throw new Error('No textbook founded');

        await wait_rand(500);

        // entering text instantly
        await form.$eval('#searchbox', (x, txt) => {
            x.setAttribute('maxlength', '100000');
            x.value = txt;
        }, all_prompt);

        // making last enter with focus
        await wait_rand(137);
        await textarea.focus();
        await textarea.type(' \n', {delay: 120});

        dbg('entered prompt, waiting for response');

        // waiting 30s for response (usually faster)
        let raw_resp = await awaiter.wait_for(30_000);

        // spesial answer - bing throttle
        if (raw_resp.item.result.value == 'Throttled') {
            dbg('bing is throttling questions');
            settings.bing_throttle = date.add(new Date(), {h: 2});
        } else {
            let bot_messages = raw_resp.item?.messages?.filter(x => x.author == 'bot' && !x.messageType).map(x => x.text);
            if (!bot_messages)
                throw new Error('Empty AI response');
            ai_resp = bot_messages.join('\n');
        }
    }

    // claude
    if (!ai_resp && !!settings.claude_skip && !settings.claude_throttle || settings.claude_throttle < new Date()) {
        ai = 'claude';
        dbg('trying claude');
        let awaiter = new Awaiter(), browser = await chromium_browser(), page = await browser.newPage();
        this.finally(()=>page.close());

        let client = await page.target().createCDPSession();
        await client.send('Network.enable');

        async function get_resp(event) {
            const {requestId, response} = event;
            let result;
            try {
                let {body, base64Encoded} = await client.send('Network.getResponseBody', {requestId});
                result = body;
                if (response.mimeType.includes('json'))
                    result = JSON.parse(result);
            } catch (e) {
                // ignored
            }
            return result;
        }

        client.on('Network.responseReceived', async event => {
            const {requestId, type, response} = event;
            const {url} = response;
            if (type == 'Fetch') {
                let body = await get_resp(event);
                if (url.endsWith('current_account')) {
                    let is_auth = 200 == response.status && body?.success;
                    if (settings.claude_auth != is_auth)
                    {
                        awaiter.resolve(settings.claude_auth = is_auth);
                    }
                }

                if (url.endsWith('chat_conversations')) {

                }
            }
        });

        await page.goto('https://claude.ai', {waitUntil: 'load'});
        let login_button = await page.$('[data-testid*="login-with-google"]');
        settings.claude_auth = !login_button;
        if (!settings.claude_auth)
        {
            page.evaluate('alert("You need to authorize by yourself!")');
            page.once('close', ()=>{
                settings.claude_skip = true;
            });
            while (!settings.claude_auth || settings.claude_skip)
            {
                try {
                    if (await awaiter.wait_for(60_000)) {
                        dbg('authorized to claude');
                        break;
                    }
                } catch (e) {
                    // problems with authentification
                    settings.claude_skip = true;
                }
            }
        }
    }

    // writing result
    if (!ai_resp)
        throw new Error('Empty AI response');

    if (ai_resp) {
        let percentage = +/\d+%/g.exec(ai_resp)?.[0]?.replace('%', '')?.trim() || 0;
        await update_one(vacancy_db, q, {ai_resp, ai, percentage});
    }
}

export async function run() {
    let db = await get_jobs_db();
    let queued = await db.findAsync({
        type: 'ai',
        end: {$exists: false},
    });
    // install prev tasks
    queue.push(...queued);

    fs.watchFile(db.filename, {interval: 200}, async () => {
        let queued = queue.queue.map(x => x._id);
        /** @type {Job[]}*/
        let tasks = await db.findAsync({
            scheduled: {$exists: false},
            start: {$exists: false},
            end: {$exists: false},
            type: 'ai'
        });
        if (!tasks.length)
            return;
        queue.push(...tasks);

        for (let {job_id} of tasks)
            await update_one(db, {job_id}, {scheduled: new Date()});
    });
}