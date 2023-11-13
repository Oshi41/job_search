import {get_vacancy_db, handler} from "../utils.js";
import {Settings} from "oshi_utils";
import {settings_path} from "./settings_server.js";
import fs from "fs";

export const use_vacancy_mw = handler(async (req, res, next) => {
    let job_id = req.query.job_id || req.params.job_id || req.body;
    if (!Number.isInteger(+job_id))
        throw Object.assign(new Error('No job ID provided'), {code: 400});
    let db = await get_vacancy_db();
    let vacancy = await db.findOne({job_id: +job_id});
    if (!vacancy)
        throw Object.assign(new Error('Such job ID not found in database'), {code: 400});
    req.vacancy = vacancy;
    req.db = db;
    next?.();
});

export const use_settings_mw = handler(async (req, res, next) => {
    req.settings = await read_settings(req.query.pass || req.params.pass);
    next?.();
});

/**
 * @param pass {string?}
 * @returns {Promise<JobSearchSettings>}
 */
export async function read_settings(pass) {
    let settings = new Settings(settings_path, pass);
    // Has nonull file
    if (fs.existsSync(settings_path) && fs.statSync(settings_path).size > 0) {
        let cfg = await settings.read();
        if (!cfg)
            throw Object.assign(new Error('Enter encryption password'), {code: 401});
        return cfg;
    } else
        return {};
}