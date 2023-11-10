import {handler} from "../utils.js";
import {join_mkfile, Settings} from "oshi_utils";
import os from "os";
import fs from "fs";
import {use_settings_mw} from "./utils.js";

export const settings_path = join_mkfile(os.homedir(), 'job_search', 'settings.json');

/**
 * @param app {Express}
 */
export function install(app) {
    app.post('/settings', handler(async req => {
        let settings = new Settings(settings_path, req.query.pass);
        let cfg = JSON.parse(req.body);
        settings.save(cfg);
        return true;
    }));
    app.get('/settings', use_settings_mw, handler(async req => {
        return req.settings;
    }));
}