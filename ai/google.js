import puppeteer from "puppeteer";
import {join_mkdir} from "oshi_utils";
import os from "os";
import {get_puppeteer} from "../utils.js";

let browser, page, client, was_init;

export async function init() {
    browser = await get_puppeteer();
    page = await browser.newPage();
    client = await page.target().createCDPSession();
}