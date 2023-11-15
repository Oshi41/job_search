import {edge_browser} from "../utils.js";
import {Awaiter} from "oshi_utils";
import {safely_wait_idle, wait_rand} from "../../utils.js";

/** @type {Page}*/
let page;
const resp_awaiter = new Awaiter('response');
function use_reauth(page) {
    let _goto = page.goto.bind(page);
    let authorized = false, is_manual_auth = false;
    const awaiter = new Awaiter('auth');
    async function is_authorized(){
        let mail = await page.evaluate(()=>window.WIZ_global_data?.oPEP7c);
        awaiter.resolve(!!mail);
        return !!mail;
    }
    page.goto = async function(url, args){
        let res = await _goto(url, args);

        if (!is_manual_auth && !await is_authorized(page))
        {
            // in manual auth
            is_manual_auth = true;
            page.evaluate('alert("You have 120s to authorize by yourself")');


            async function listener(){
                if (await is_authorized())
                {
                    // finish manual auth
                    is_manual_auth = false;
                    // authorize successfully
                    authorized = true;

                    // revisiting original page
                    awaiter.resolve(await page.goto(url, args));
                }
            }

            page.on('response', listener);
            try {
                return awaiter.wait_for(120_000);
            } finally {
                page.off('response', listener);
            }
        }

        return res;
    };
}

export async function ask(question) {
    if (!page)
    {
        let browser = await edge_browser();
        page = await browser.newPage();
        use_reauth(page);

        page.on('response', async resp=>{
            let url = resp.url();
            if (url.includes('StreamGenerate'))
            {
                await safely_wait_idle(page, 0.5);
                let txt = await page.evaluate(()=>{
                    let latest = Array.from(document.querySelectorAll('.model-response-text')).pop();
                    return latest && latest.outerHTML;
                });
                resp_awaiter.resolve(txt);
            }
        });
    }

    let chat_url = 'https://bard.google.com/chat';
    if (!page.url().includes(chat_url))
        await page.goto('https://bard.google.com/chat', {waitUntil: 'networkidle0'});


    let selector = '#mat-input-0'
    const textarea = await page.$(selector);
    if (!textarea)
        throw new Error('Cannot enter text');

    // entering text instantly
    await page.$eval(selector, (x, txt) => {
        x.setAttribute('maxlength', '100000');
        x.value = txt;
    }, question);

    // making last enter with focus
    await wait_rand(137);
    await textarea.focus();
    textarea.type(' \n', {delay: 120});

    let html_content = await resp_awaiter.wait_for(30_000);
    if (!html_content)
        throw new Error('empty_response');

    return html_content;
}