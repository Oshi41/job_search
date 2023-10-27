import {sleep} from "oshi_utils";

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
    } catch (e) {
        // ignored
    }
}