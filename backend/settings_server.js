import {handler} from "../utils.js";
import {join_mkfile, Settings} from "oshi_utils";
import os from "os";
import fs from "fs";

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
    app.get('/settings', handler(async req => {
        let settings = new Settings(settings_path, req.query.pass);
        if (fs.existsSync(settings_path) && fs.statSync(settings_path).size > 0) {
            let cfg = await settings.read();
            if (!cfg)
                throw Object.assign(new Error('Enter encryption password'), {code: 401});

            return cfg;
        }

        return {};
    }));
}